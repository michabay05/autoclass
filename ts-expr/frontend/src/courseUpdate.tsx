import { useState, useEffect } from "preact/hooks";
import { useLocation } from "react-router";
import { ReactSortable } from "react-sortablejs";
import { Book, GripHorizontal, Lock, ListChecks } from "lucide-react";
import "./courseUpdate.css";

import type { ItemInfo, ExportItemInfo, TopicInfo } from "../../common/types";
import { CourseState, ItemState, ItemKind, getItemState } from "../../common/types";

interface ExportItemProps {
    expItem: ExporItem,

    toggleLocked: () => void;
    updateTiming: (value: string) => boolean;
}

export default function CourseUpdate() {
    const props: Course = useLocation().state;

    const [exportItems, setExportItems] = useState<ExportItem[]>([]);
    const [topics, setTopics] = useState<TopicInfo[]>([]);

    useEffect(() => {
        const fetchTopics = async () => {
            const res = await fetch(`/api/topics/${props.id}`,
                {credentials: "include"});
            const topics = await res.json();
            setTopics(topics);
        };

        const fetchItems = async () => {
            const res = await fetch(`/api/items/${props.id}`,
                {credentials: "include"});
            const items = await res.json();
            setExportItems(items.map((it, i) => ({
                item: it,
                timing: "",
                locked: false
            })));
        };

        fetchTopics();
        fetchItems();
    }, [])

    const toggleLocked = (itemId: string) => {
        setExportItems(exportItems.map(eIt => {
            if (eIt.item.id === itemId) return {...eIt, locked: !eIt.locked };
            else return eIt;
        }));
    };

    const updateTiming = (itemId: string, value: string): boolean => {
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

        setExportItems(exportItems.map(eIt => {
            if (eIt.item.id === itemId) return {...eIt, timing: value };
            else return eIt;
        }));

        return true;
    };

    const postExportItems = async () => {
        const allComplete = (): boolean => {
            for (const eIt of exportItems) {
                if (eIt.timing.length === 0) {
                    return false;
                }
            }
            return true;
        }

        if (!allComplete()) {
            alert("Ensure that you have filled out all timings before exporting");
            return;
        }

        const body: ExportTimings = {
            courseId: props.id,
            topics: topics,
            exportItems: exportItems
        };
        console.log(body);

        const response = await fetch("/api/apply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const resJSON = await response.json();
        console.log(resJSON);
    };

    return (
        <div className="w-9/10 max-w-4xl mx-auto">
            <div className="flex justify-between items-center my-3 p-2">
                <div>
                    <h1 className="text-3xl font-bold">{props.name}</h1>
                    <h2 className="text-md">State: {CourseState[props.state]}</h2>
                </div>

                <div>
                    <button onClick={postExportItems}
                        className="bg-red-400 px-7 py-3 rounded cursor-pointer">
                       Export
                    </button>
                </div>
            </div>

            <ReactSortable
                list={exportItems} setList={setExportItems} handle=".handle-grip"
                className="flex flex-col items-center" animation={250}
            >
            {
                exportItems.map(eIt => {
                    return <Item key={eIt.item.id} expItem={eIt}
                        toggleLocked={() => toggleLocked(eIt.item.id)}
                        updateTiming={(value: string) => updateTiming(
                            eIt.item.id, value)}
                    />;
                })
            }
            </ReactSortable>
        </div>
    );
}

function Item({expItem, toggleLocked, updateTiming}: ExportItemProps) {
    const {item, locked, timing} = expItem;
    const state = ItemState[item.state];

    const style = {
        fill: "bg-blue-400",
        bord: "border-blue-600"
    };
    if (item.kind === ItemKind.MATERIAL) {
        style.fill = "bg-green-500";
        style.bord = "border-green-700";
    }

    return (
        <div className={`${style.fill} border-4 ${style.bord} w-full flex
            justify-between p-5 mb-2 rounded-lg`}>
            {/* Left */}
            <div className="flex items-center w-3/10">
                <span className="mr-4">
                    { item.kind === ItemKind.MATERIAL ? (<Book />) : (<ListChecks />) }
                </span>
                <div>
                    <p>{item.title}</p>
                    <span className={`w-auto border-3 rounded-3xl px-1 text-xs`}>
                        {state}</span>
                </div>
            </div>

            {/* Center */}
            <div className="flex items-center w-1/5">
                <input type={locked ? "date" : "number"}
                    className="p-2 border-2 rounded w-full" placeholder="Days"
                    value={timing} onBlur={e => {
                        if (!updateTiming(e.target.value)) e.target.value = "";
                    }}
                />
            </div>

            {/* Right */}
            <div className="flex items-center">
                <button onClick={toggleLocked}
                    className={"cursor-pointer p-2 rounded active:scale-95 " +
                        (locked ? "outline-2 " : "opacity-60")
                    }
                >
                    <Lock />
                </button>
                <GripHorizontal className="cursor-grab handle-grip ml-5 active:scale-95" />
            </div>
        </div>
    );
}


