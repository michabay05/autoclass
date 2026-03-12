import type { ExportTimings } from "../common/types";
import { ItemState, ItemKind, getItemState, getItemKind } from "../common/types";

interface TimeDelta {
    days: number
}

class Timing {
    desc: Date | TimeDelta;
    locked: boolean;

    constructor(desc: string | TimeDelta) {
        if (typeof desc === "string") {
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
            dt.setDate(prev.getDate() + this.desc.days);
            return dt;
        }
    }
}

export const loadTimingConfig = async (path: string): ExportTimings => {
    const timingFile = Bun.file(path);
    const content = await timingFile.json();

    const exportItems: ExportItemInfo[] = [];
    for (const eIt of content.exportItems) {
        exportItems.push({
            item: {
                kind: getItemKind(eIt.item.kind),
                courseId: eIt.item.courseId,
                id: eIt.item.id,
                title: eIt.item.title,
                description: eIt.item.description || null,
                state: getItemState(eIt.item.state),
                creationTime: Date.parse(eIt.item.creationTime),
            },
            locked: eIt.locked,
            timing: eIt.timing
        });
    }

    const timings: ExportTimings = {};
    timings["courseId"] = content["courseId"];
    timings["topics"] = content["topics"]
    timings["exportItems"] = exportItems;
    return timings;
};

export const saveTimingConf = async (conf: ExportTimings, path: string) => {
    const outItems = []
    for (const eIt of conf.exportItems) {
        const {item, locked, timing} = eIt;
        outItems.push({
            "item": {
                ...item,
                "kind": ItemKind[item.kind],
                "state": ItemState[item.state],
            },
            "locked": locked,
            "timing": timing,
        });
    }

    const output: ExportTimings = {
        "courseId": conf.courseId,
        "topics": conf.topics,
        "exportItems": outItems
    };
    await Bun.write(path, JSON.stringify(output, null, 4));
};

// const timing = await loadTimingConfig("MY_sample-timings.json");
// await saveTimingConf(timing, "s.json");
