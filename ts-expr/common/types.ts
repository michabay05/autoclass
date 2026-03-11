export enum CourseState {
    Active,
    Archived,
    Declined
}

export interface Course {
    id: string;
    name: string;
    section: string;
    state: CourseState;
    creationDate: Date;
}

export const getCourseState = (stateStr: string): CourseState => {
    switch (stateStr) {
        case "ACTIVE"  : return CourseState.Active;
        case "ARCHIVED": return CourseState.Archived;
        case "DECLINED": return CourseState.Declined;
        default: throw new Error(`Unknown state str: ${stateStr}`);
    }
}

export enum ItemState {
    Published,
    Draft,
    Deleted
}

export enum ItemKind {
    Material,
    Assignment
}

export interface Item {
    kind: ItemKind;
    courseId: string;
    id: string;
    title: string;
    description: string;
    state: ItemState;
    creationTime: Date;
}

export const getItemState = (itemStateStr: string): ItemState => {
    switch (itemStateStr) {
        case "PUBLISHED": return ItemState.Published;
        case "DRAFT": return ItemState.Draft;
        case "DELETED": return ItemState.Deleted;
        default: throw new Error(`Unknown item state str: ${itemStateStr}`)
    }
}
