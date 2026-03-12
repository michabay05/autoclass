export enum CourseState { ACTIVE, ARCHIVED, DECLINED }
export interface Course {
    id: string;
    name: string;
    section: string;
    state: CourseState;
    creationDate: Date;
}

export const getCourseState = (stateStr: string): CourseState => {
    switch (stateStr.toUpperCase()) {
        case "ACTIVE"  : return CourseState.ACTIVE;
        case "ARCHIVED": return CourseState.ARCHIVED;
        case "DECLINED": return CourseState.DECLINED;
        default: throw new Error(`Unknown course state str: ${stateStr}`);
    }
}

export enum ItemState { PUBLISHED, DRAFT, DELETED, UNKNOWN }
export enum ItemKind { MATERIAL, ASSIGNMENT }
export interface ItemInfo {
    kind: ItemKind;
    courseId: string;
    id: string;
    title: string;
    description: string;
    state: ItemState;
    creationTime: Date;
}

export const getItemKind = (kindStr: string): ItemKind => {
    switch (kindStr.toUpperCase()) {
        case "MATERIAL": return ItemKind.MATERIAL;
        case "ASSIGNMENT": return ItemKind.ASSIGNMENT;
        default:
            console.error(`Unknown item kind: ${kindStr}`);
            throw new Error()
    }
}

export const getItemState = (stateStr: string): ItemState => {
    switch (stateStr.toUpperCase()) {
        case "PUBLISHED": return ItemState.PUBLISHED;
        case "DRAFT"    : return ItemState.DRAFT;
        case "DELETED"  : return ItemState.DELETED;
        default:
            console.error(`Unknown item state: ${stateStr}`);
            return ItemState.UNKNOWN;
    }
}

export interface ExportItemInfo {
    item: ItemInfo;
    locked: boolean;
    timing: string;
}

export interface ExportTiming {
    // TODO: the default action (assumption) to clone with modification
    courseId: string;
    exportItems: ExportItemInfo[];
}

