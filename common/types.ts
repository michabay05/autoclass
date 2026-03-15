export enum CourseState { ACTIVE, ARCHIVED, DECLINED, PROVISIONED }
export interface Course {
    id: string;
    name: string;
    section: string;
    state: CourseState;
    creationDate: Date;
}

export const getCourseState = (stateStr: string): CourseState => {
    switch (stateStr.toUpperCase()) {
        case "ACTIVE"     : return CourseState.ACTIVE;
        case "ARCHIVED"   : return CourseState.ARCHIVED;
        case "DECLINED"   : return CourseState.DECLINED;
        case "PROVISIONED": return CourseState.PROVISIONED;
        default: throw new Error(`Unknown course state str: ${stateStr}`);
    }
}

export enum ItemKind { MATERIAL, ASSIGNMENT }
export const getItemKind = (kindStr: string): ItemKind => {
    switch (kindStr.toUpperCase()) {
        case "MATERIAL": return ItemKind.MATERIAL;
        case "ASSIGNMENT": return ItemKind.ASSIGNMENT;
        default:
            console.error(`Unknown item kind: ${kindStr}`);
            throw new Error()
    }
}

export interface ExportItemInfo {
    kind: ItemKind;
    itemId: string;
    locked: boolean;
    timing: string;

    contentLabel: string;
    timeLabel: string;
}

export interface ExportTimings {
    // NOTE: the default action (assumption) to clone with modification
    // In the future, modifying existing items should be available as well
    courseId: string;
    rawItems: object;
    exportItems: ExportItemInfo[];
}

