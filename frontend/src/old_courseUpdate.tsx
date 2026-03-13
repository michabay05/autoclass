import { Fragment, render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import "./courseUpdate.css";
import { useLocation } from "react-router";

import { ReactSortable } from "react-sortablejs";
import { Book, GripHorizontal, Lock, ListChecks } from "lucide-react";

interface CourseProps {
    courseId: string;
    name: string;
    state: string
}

enum ItemKind {
    Material,
    Assignment,
}

interface ItemProps {
    keyId: number;

    itemId: string;
    kind: ItemKind;
    title: string;
    state: string;
    topicId: string;

    locked: string;
    toggleLocked: () => void;

    timing: string;
    updateTiming: (value: string) => boolean;
}

interface ExportItem {
    itemId: string;
    kind: ItemKind;
    title: string;
    state: string;
    topicId: string;
    locked: string;
    timing: string;
}

interface ExportData {
    courseId: string;
    items: ExportItem[];
}

export default function CourseUpdate() {
    const [itemList, setItemList] = useState<ItemProps[]>([]);
    const [course, setCourse] = useState<CourseProps>({});

    useEffect(() => {
        const fetchAndSetItems = async () => {
            const res = await fetch("./MY_sample-items.json");
            const resJson = await res.json();

            setCourse({
                name: resJson?.info.name,
                courseId: resJson?.info.id,
                state: resJson?.info.courseState,
            });

            const items: ItemProps[] = [];
            let counter = 0;
            for (const mat of resJson?.materials) {
                items.push({
                    keyId: counter++,

                    itemId: mat.id,
                    kind: ItemKind.Material,
                    title: mat.title,
                    state: mat.state,
                    topicId: mat.topicId,
                    locked: false,
                    timing: "",
                });
            }

            for (const assign of resJson?.assignments) {
                items.push({
                    keyId: counter++,

                    itemId: assign.id,
                    kind: ItemKind.Assignment,
                    title: assign.title,
                    state: assign.state,
                    topicId: assign.topicId,
                    locked: false,
                    timing: "",
                });
            }

            setItemList(items);
        };

        fetchAndSetItems();
    }, []);

    const toggleLocked = (keyId: number) => {
        setItemList(itemList.map(item => {
            if (item.keyId === keyId) return {...item, locked: !item.locked };
            else return item;
        }));
    };

    const updateTiming = (keyId: number, value: string): boolean => {
        if (value.length === 0) return false;

        const isValidTiming = (value: string): boolean => {
            const parsedNumValue = Number.parseInt(value);
            // TODO: There probably is a way to refactor this `if` tree, but I won't
            // do that now. You do it now...
            if (!isNaN(parsedNumValue)) {
                return true;
            } else {
                const parsedDateValue = Date.parse(value);
                if (!isNaN(parsedDateValue)) {
                    return true;
                } else {
                    alert("Unknown value given for timing");
                    return false;
                }
            }
        };

        if (!isValidTiming(value)) return false;

        setItemList(itemList.map(item => {
            if (item.keyId === keyId) return {...item, timing: value };
            else return item;
        }));

        return true;
    };

    const exportItems = (course: CourseProps, items: ItemProps[]): ExportData => {
        const exports: ExportItem[] = [];
        for (const item of items) {
            const itemKind = item.kind === ItemKind.Material
                ? "material" : "assignment";
            exports.push({
                itemId: item.itemId,
                kind: itemKind,
                locked: item.locked,
                timing: item.timing,
            });
        }

        return {
            courseId: course.courseId,
            items: exports
        };
    }

    const handleExport = () => {
        let allComplete = true;
        for (const item of itemList) {
            if (item.timing.length === 0) {
                allComplete = false;
                break;
            }
        }

        if (!allComplete)
            alert("Ensure that you have filled out all timings before exporting");

        const out = exportItems(course, itemList);
        console.log(out);
    };

    return <div className="w-9/10 max-w-4xl mx-auto">
        <header className="flex justify-between p-6 my-2 items-center">
            <div className="flex flex-col">
                <span className="text-3xl font-bold"> {course.name} </span>
                <span className="inline-block text-sm"> {course.state} </span>
            </div>
            <nav className="flex">
                <button className="bg-red-500 py-3 px-8 rounded-sm cursor-pointer"
                    onClick={() => handleExport()}
                >
                    Export
                </button>
            </nav>
        </header>

        <div className="h-9/10 max-h-screen overflow-scroll">
            <ReactSortable
                swap
                list={itemList} setList={setItemList} handle=".handle-grip"
                className="flex flex-col items-center" animation={250}
            >
            {
                itemList.map(itemProps => {
                    return <Item key={itemProps.keyId} {...itemProps}
                        toggleLocked={() => toggleLocked(itemProps.keyId)}
                        updateTiming={(value: string) => updateTiming(itemProps.keyId, value)}
                    />;
                })
            }
            </ReactSortable>
        </div>
    </div>;
}

function Item(props) {
    const style = {
        fill: "bg-blue-600",
        bord: "border-blue-800"
    };
    if (props.kind === ItemKind.Material) {
        style.fill = "bg-green-600";
        style.bord = "border-green-700";
    }

    return (
        <div className={`${style.fill} border-4 ${style.bord} w-full flex
            justify-between p-5 mb-4 rounded-lg`}>
            {/* Left */}
            <div className="flex items-center w-3/10">
                <span className="mr-4">
                    { props.kind === ItemKind.Material
                            ? (<Book />)
                            : (<ListChecks />) }
                </span>
                <div>
                    <p>{props.title}</p>
                    <span className={`w-auto border-3 rounded-3xl px-1 text-xs`}>{props.state}</span>
                </div>
            </div>

            {/* Center */}
            <div className="flex items-center w-1/5">
                <input type={props.locked ? "date" : "number"}
                    className="p-2 border-2 rounded w-full" placeholder="Days"
                    value={props.timing} onBlur={e => {
                        if (!props.updateTiming(e.target.value)) e.target.value = "";
                    }}
                />
            </div>

            {/* Right */}
            <div className="flex items-center">
                <button onClick={props.toggleLocked}
                    className={"cursor-pointer p-2 rounded active:scale-95 " +
                        (props.locked ? "outline-2 " : "opacity-60")
                    }
                >
                    <Lock />
                </button>
                <GripHorizontal className="cursor-grab handle-grip ml-5 active:scale-95" />
            </div>
        </div>
    );
}

