import { Fragment, render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import "./index.css";

import { ReactSortable } from "react-sortablejs";
import { Book, GripHorizontal, Lock, ListChecks } from "lucide-react";

interface CourseProps {
    name: string;
    state: string
}

enum ItemKind {
    Material,
    Assignment,
}

type Timing = number | Date;

interface ItemProps {
    keyId: number;
    kind: ItemKind;
    title: string;
    state: string;
    topicId: string;

    locked: string;
    toggleLocked: () => void;

    timing: Timing;
    updateTiming: (value: string) => boolean;
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

export default function App() {
    const [itemList, setItemList] = useState<ItemProps[]>([]);
    const [course, setCourse] = useState<CourseProps>({});

    useEffect(() => {
        const fetchAndSetItems = async () => {
            const res = await fetch("./sample-items.json");
            const resJson = await res.json();

            setCourse({
                name: resJson?.info.name,
                state: resJson?.info.courseState,
            });

            const items: ItemProps[] = [];
            let counter = 0;
            for (const mat of resJson?.materials) {
                items.push({
                    keyId: counter++,
                    kind: ItemKind.Material,
                    title: mat.title,
                    state: mat.state,
                    topicId: mat.topicId,
                    locked: false,
                });
            }

            for (const assign of resJson?.assignments) {
                items.push({
                    keyId: counter++,
                    kind: ItemKind.Assignment,
                    title: assign.title,
                    state: assign.state,
                    topicId: assign.topicId,
                    locked: false,
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
        let success = true;

        const parseTiming = (value: string): Timing | null => {
            const parsedNumValue = Number.parseInt(value);
            if (!isNaN(parsedNumValue)) {
                return parsedNumValue;
            } else {
                const parsedDateValue = Date.parse(value);
                if (!isNaN(parsedDateValue)) {
                    return parsedDateValue;
                } else {
                    alert("Unknown value given for timing");
                    success = false;
                    return "";
                }
            }
        };

        setItemList(itemList.map(item => {
            if (item.keyId === keyId) return {...item, timing: parseTiming(value) };
            else return item;
        }));

        return success;
    };

    return <div className="w-9/10 max-w-4xl mx-auto">
        <header className="flex justify-between p-6 my-2 items-center">
            <div className="flex flex-col">
                <span className="text-3xl font-bold">
                    {course.name}
                </span>
                <span className="inline-block">
                    {course.state}
                </span>
            </div>
            <nav className="flex">
                <input type="date"
                    className="border-2 border px-6 py-4 rounded"
                />
                <input type="time"
                    className="border-2 border px-6 py-4 rounded mr-5"
                />
                <button className="bg-red-500 px-8 rounded-sm cursor-pointer">
                    Save
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

render(<App />, document.getElementById("app"))
