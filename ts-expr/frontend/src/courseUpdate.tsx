import { useState, useEffect } from "preact/hooks";
import { useLocation } from "react-router";
import { ReactSortable } from "react-sortablejs";
import { Book, GripHorizontal, Lock, ListChecks } from "lucide-react";
import "./courseUpdate.css";
import type { Item } from "../../common/types";
import { ItemState, ItemKind } from "../../common/types";

interface ExportItem {
    item: Item,
    timing: string;
    locked: boolean
}

interface ExportItemProps {
    expItem: ExporItem,

    toggleLocked: () => void;
    updateTiming: (value: string) => boolean;
}


export default function CourseUpdate() {
    const props: Course = useLocation().state;

    const [exportItems, setExportItems] = useState<ExportItem[]>([]);

    useEffect(() => {
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

    // console.log(exportItems);

    return (
        <>
            <p>Course with id: {props.id}</p>
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
        </>
    );
}

function Item({expItem, toggleLocked, updateTiming}: ExportItemProps) {
    const {item, locked, timing} = expItem;

    let state = "UNKNOWN";
    switch (item.state) {
        case ItemState.Published: state = "PUBLISHED"; break;
        case ItemState.Draft    : state = "DRAFT"; break;
    }

    const style = {
        fill: "bg-blue-600",
        bord: "border-blue-800"
    };
    if (item.kind === ItemKind.Material) {
        style.fill = "bg-green-600";
        style.bord = "border-green-700";
    }

    return (
        <div className={`${style.fill} border-4 ${style.bord} w-full flex
            justify-between p-5 mb-2 rounded-lg`}>
            {/* Left */}
            <div className="flex items-center w-3/10">
                <span className="mr-4">
                    { item.kind === ItemKind.Material
                            ? (<Book />)
                            : (<ListChecks />) }
                </span>
                <div>
                    <p>{item.title}</p>
                    <span className={`w-auto border-3 rounded-3xl px-1 text-xs`}>{state}</span>
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


