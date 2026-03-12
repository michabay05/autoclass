import type { ExportTimings } from "../common/types";
import { ItemKind, getItemKind } from "../common/types";

interface TimeDelta {
    days: number
}

class Timing {
    desc: string;
    locked: boolean;

    constructor(desc: string) {
        // NOTE: If isNaN(desc) is true, the assumption is that JS tried to type-coerce desc into a number and failed. That failure then implies that the string desc was not a number. If isNaN(desc) is false, then that means that it is a number.
        if (isNaN(desc)) {
            this.desc = new Date(desc);
            this.locked = true;
        } else {
            this.desc = desc;
            this.locked = false;
        }
    }

    toAbsolute(prev: Date): Date {
        if (this.locked) {
            return this.desc;
        } else {
            const dt = new Date(prev);
            const day = Number.parseInt(this.desc);
            dt.setDate(prev.getDate() + day);
            return dt;
        }
    }
}

// export const loadTimingConfig = async (path: string): ExportTimings => {
//     const timingFile = Bun.file(path);
//     const content = await timingFile.json();
//
//     const exportItems: ExportItemInfo[] = [];
//     for (const eIt of content.exportItems) {
//         exportItems.push({
//             item: {
//                 kind: getItemKind(eIt.item.kind),
//                 courseId: eIt.item.courseId,
//                 id: eIt.item.id,
//                 title: eIt.item.title,
//                 description: eIt.item.description,
//                 creationTime: new Date(eIt.item.creationTime),
//             },
//             locked: eIt.locked,
//             timing: eIt.timing
//         });
//     }
//
//     const timings: ExportTimings = {};
//     timings["courseId"] = content["courseId"];
//     timings["topics"] = content["topics"]
//     timings["exportItems"] = exportItems;
//     return timings;
// };

// export const saveTimingConf = async (conf: ExportTimings, path: string) => {
//     await Bun.write(path, JSON.stringify(conf, null, 4));
// };

// const timing = await loadTimingConfig("ex.json");
// await saveTimingConf(timing, "ex1.json");

export const applyChanges = async (classroom: any, timings: ExportTimings): object => {
    // Steps to applying changes
    // - Create the course
    // - Create the topics in course
    // - Resolve dates to be absolute
    // - Create the materials
    // - Create the assignments

    const now = new Date();
    const unique = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;

    const courseResponse = await classroom.courses.create({
        requestBody: createCourseAttributes(
            `Test-${unique}`, `Section-${unique}`)
    });
    const newCourse = courseResponse.data;
    const newCourseId = newCourse.id;

    const topicResponses = await Promise.all(
        timings.rawItems.rawTopics.map(rTopic => (
            classroom.courses.topics.create({
                courseId: newCourseId,
                requestBody: createTopicAttributes(rTopic.name),
            })
        ))
    );

    // Old topic id: topic name
    const oldTopicMappings: Record<string, string> = {};
    for (const rTopic of timings.rawItems.rawTopics) {
        oldTopicMappings[rTopic.topicId] = rTopic.name
    }

    // topic name: New topic id
    const newTopicMappings: Record<string, string> = {};
    for (const topicRes of topicResponses) {
        newTopicMappings[topicRes.data.name] = topicRes.data.topicId;
    }

    // Item id: Publish Date of item
    const resolvedTimings: Record<string, Date> = resolvedPublishTimings(timings);

    const materialReqs = [];
    const assignmentReqs = [];
    for (const eIt of timings.exportItems) {
        const foundItem = findItemById(timings.rawItems, eIt.itemId);
        if (foundItem === null) {
            console.warn("Skipping an item due to a lack of timing for it");
            continue;
        }

        const {kind, rawItem} = foundItem;
        switch (kind) {
            case ItemKind.MATERIAL:
                materialReqs.push(
                    overrideMaterialAttributes(
                        rawItem,
                        newTopicMappings[oldTopicMappings[rawItem.topicId]] || null,
                        resolvedTimings[eIt.itemId]
                    )
                )
                break;

            case ItemKind.ASSIGNMENT:
                assignmentReqs.push(
                    overrideAssignmentAttributes(
                        rawItem,
                        newTopicMappings[oldTopicMappings[rawItem.topicId]] || null,
                        resolvedTimings[eIt.itemId],
                    )
                )
                break;
        }
    }

    const itemResponses = await Promise.all([
        ...materialReqs.map(mReq => (
            classroom.courses.courseWorkMaterials.create({
                courseId: newCourseId,
                requestBody: mReq,
            })
        )),

        ...assignmentReqs.map(aReq => (
            classroom.courses.courseWork.create({
                courseId: newCourseId,
                requestBody: aReq,
            })
        )),
    ]);
};

const createCourseAttributes = (
    name: string, section: string, room: string | null = null,
    subject: string | null = null,
) => {
    return {
        name: name,
        section: section,
        ownerId: "me",
        room: room,
        subject: subject,
    };
};

const createTopicAttributes = (name: string) => {
    return { name: name };
};

const overrideMaterialAttributes = (
    origMat: object, topicId: string, scheduledTime: Date
) => {
    return {
        ...origMat,
        topicId: topicId,
        scheduledTime: scheduledTime.toISOString(),
        state: "DRAFT",
    };
};

const overrideAssignmentAttributes = (
    origAssign: object, topicId: string, scheduledTime: Date,
    dueDt: Date | null = null, maxPoints: number = 0
) => {
    const assign = {...origAssign};
    assign.topicId = topicId;
    assign.scheduledTime = scheduledTime.toISOString();
    // NOTE: This has to be a draft in order for the scheduled time attribute
    // to work
    assign.state = "DRAFT";
    if (dueDt !== null) {
        assign.dueDt = {
            year: dueDt.getFullYear(),
            month: dueDt.getMonth(),
            day: dueDt.getDate(),
        };

        assign.dueTime = {
            hours: dueDt.getHours(),
            minutes: dueDt.getMinutes(),
            // NOTE: I don't think this level of specificity is required but I
            // guess I will do it instead of placing a random constant that
            // might piss me off down the line.
            seconds: dueDt.getSeconds(),
        };
    }

    if (maxPoints > 0) {
        assign.maxPoints = maxPoints;
    }

    return assign;
};

const resolvedPublishTimings = (timings: ExportTimings): Record<string, Date> => {
    const idTimingMap: Record<string, Timing> = {};

    for (const eIt of timings.exportItems) {
        idTimingMap[eIt.itemId] = new Timing(eIt.timing);
    }

    const resolved: Record<string, Timing> = {};
    let start = new Date();
    for (const idKey in idTimingMap) {
        const dt = idTimingMap[idKey].toAbsolute(start);
        resolved[idKey] = dt;
        // TODO: Come back and make sure that all timings are in ascending
        // order (in other words, the resolved timing of one thing should not
        // be ahead of another timing placed in the index ahead of it.
        start = dt;
    }

    return resolved;
}

const findItemById = (rawItems: object, itemId: string): object | null => {
    for (const rMat of rawItems.rawMaterials) {
        if (rMat.id === itemId) {
            return {
                kind: ItemKind.MATERIAL,
                rawItem: rMat
            };
        }
    }

    for (const rAssign of rawItems.rawAssignments) {
        if (rAssign.id === itemId) {
            return {
                kind: ItemKind.ASSIGNMENT,
                rawItem: rAssign
            };
        }
    }

    return null;
};
