import { useState, useEffect } from "preact/hooks";
import { useLocation } from "react-router";
import { ReactSortable } from "react-sortablejs";
import { Book, GripHorizontal, Lock, ListChecks } from "lucide-react";
import "./courseUpdate.css";

import type { ExportItemInfo } from "../../common/types";
import { CourseState, ItemKind } from "../../common/types";

export default function CourseUpdate() {
    const props: Course = useLocation().state;

    const [exportItems, setExportItems] = useState<ExportItemInfo[]>([]);
    const [rawItems, setRawItems] = useState([]);

    useEffect(() => {
        const fetchRawItems = async () => {
            const res = await fetch(`/api/rawItems/${props.id}`,
                {credentials: "include"});
            const rItems = await res.json();
            setRawItems(rItems);

            const expItems: ExportItemInfo = [];
            for (const mat of rItems.rawMaterials) {
                expItems.push({
                    kind: ItemKind.MATERIAL,
                    itemId: mat.id,
                    locked: false,
                    timing: "",
                });
            }

            for (const assign of rItems.rawAssignments) {
                expItems.push({
                    kind: ItemKind.ASSIGNMENT,
                    itemId: assign.id,
                    locked: false,
                    timing: "",
                });
            }
            console.log(expItems);

            setExportItems(expItems);
        };

        fetchRawItems();
    }, [])

    const toggleLocked = (itemId: string) => {
        setExportItems(exportItems.map(eIt => {
            if (eIt.itemId === itemId) return {...eIt, locked: !eIt.locked };
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
            if (eIt.itemId === itemId) return {...eIt, timing: value };
            else return eIt;
        }));

        return true;
    };

    const getUsefulInfoFromRaw = (itemId: string, kind: ItemKind): object => {
        let raw = [];
        switch (kind) {
            case ItemKind.MATERIAL  : raw = rawItems.rawMaterials; break;
            case ItemKind.ASSIGNMENT: raw = rawItems.rawAssignments; break;
        }

        const info = {
            title: "Unknown title",
            state: "Unknown state"
        };
        for (const it of raw) {
            if (it.id === itemId) {
                info.title = it.title;
                info.state = it.state;
            }
        }
        return info;
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
            rawItems: rawItems,
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
        <>
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
                    const {title, state} = getUsefulInfoFromRaw(
                        eIt.itemId, eIt.kind);
                    return <Item key={eIt.itemId} expItem={eIt}
                        title={title} state={state}
                        toggleLocked={() => toggleLocked(eIt.itemId)}
                        updateTiming={(value: string) => updateTiming(
                            eIt.itemId, value)}
                    />;
                })
            }
            </ReactSortable>
        </>
    );
}

interface ExportItemProps {
    expItem: ExporItem;
    title: string;
    state: string;

    toggleLocked: () => void;
    updateTiming: (value: string) => boolean;
}

function Item({expItem, title, state, toggleLocked, updateTiming}: ExportItemProps) {
    const {itemId, kind, locked, timing} = expItem;

    const style = {
        fill: "bg-blue-400",
        bord: "border-blue-600"
    };
    if (kind === ItemKind.MATERIAL) {
        style.fill = "bg-green-500";
        style.bord = "border-green-700";
    }

    return (
        <div className={`${style.fill} border-4 ${style.bord} w-full flex
            justify-between p-5 mb-2 rounded-lg`}>
            {/* Left */}
            <div className="flex items-center w-3/10">
                <span className="mr-4">
                    { kind === ItemKind.MATERIAL ? (<Book />) : (<ListChecks />) }
                </span>
                <div>
                    <p>{title}</p>
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


