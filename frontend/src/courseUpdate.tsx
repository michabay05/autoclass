import { useState, useEffect, useRef } from "preact/hooks";
import { useLocation } from "react-router";
import { ReactSortable } from "react-sortablejs";
import {
    Book, GripHorizontal, Lock, ListChecks, Plus, X, OctagonX,
    ChevronDown, BadgeCheck
} from "lucide-react";

import type { ExportItemInfo } from "../../common/types";
import { CourseState, ItemKind } from "../../common/types";

interface ExpMetaData {
    title: string;
    state: string;
    creationTime: string;
}

type ExpIdMetaMap = Record<string, ExpMetaData>;
type TimeLabelConf = Record<string, string | null>;
type ContentLabelConf = Record<string, number | null>;

const MAX_LABELS: number = 16;

enum LabelKind { CONTENT, TIME }
enum DayOfWeek { SUN, MON, TUE, WED, THU, FRI, SAT, NONE }

export default function CourseUpdate() {
    const props: Course = useLocation().state;

    const [exportItems, setExportItems] = useState<ExportItemInfo[]>([]);
    const [expMetaData, setExpMetaData] = useState<ExpIdMetaMap>({});
    const [rawItems, setRawItems] = useState([]);

    const [contentLabels, setContentLabels] = useState<string[]>([]);
    const [timeLabels, setTimeLabels] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [timeLabelConf, setTimeLabelConf] = useState<TimeLabelConf>({});
    const [contentLabelConf, setContentLabelConf] = useState<ContentLabelConf>({});
    const [startDate, setStartDate] = useState<Date>(null);

    const [itemsAreValid, setItemsAreValid] = useState<boolean>(false);
    const [confIsValid, setConfIsValid] = useState<boolean>(false);

    useEffect(() => {
        const fetchRawItems = async () => {
            const res = await fetch(`/api/rawItems/${props.id}`,
                {credentials: "include"});
            const rItems = await res.json();
            setRawItems(rItems);

            const expItems: ExportItemInfo[] = [];
            const expMetas: ExpIdMetaMap = {};
            for (const mat of rItems.rawMaterials) {
                expItems.push({
                    kind: ItemKind.MATERIAL,
                    itemId: mat.id,
                    locked: false,
                    timing: "",
                });

                expMetas[mat.id] = getExpMetaFromRaw(
                    rItems, mat.id, ItemKind.MATERIAL);
            }

            for (const assign of rItems.rawAssignments) {
                expItems.push({
                    kind: ItemKind.ASSIGNMENT,
                    itemId: assign.id,
                    locked: false,
                    timing: "",
                });

                expMetas[assign.id] = getExpMetaFromRaw(
                    rItems, assign.id, ItemKind.ASSIGNMENT);
            }
            setExpMetaData(expMetas);

            expItems.sort((a, b) => {
                const aTime = expMetas[a.itemId].creationTime.getTime();
                const bTime = expMetas[b.itemId].creationTime.getTime();
                // // Most recent to oldest
                // return bTime - aTime;

                // Oldest to most recent
                return aTime - bTime;
            });
            setExportItems(expItems);
        };

        fetchRawItems();
    }, []);

    const isTruthy = (x: any): boolean => {
        return x ? true : false;
    };

    useEffect(() => {
        let valid = true;
        exportItems.map(eIt => {
            valid = valid && isTruthy(eIt.contentLabel) && isTruthy(eIt.timeLabel);
        });
        setItemsAreValid(valid);
    }, [exportItems]);

    useEffect(() => {
        let valid = true;
        valid = (timeLabels.length > 0) && (contentLabels.length > 0);
        valid = valid && isTruthy(startDate);

        // I might not really need this but I will include it anyway
        valid = valid && (timeLabels.length === Object.keys(timeLabelConf).length)
                && (contentLabels.length === Object.keys(contentLabelConf).length);

        timeLabels.map(timeLabel => {
            valid = valid && isTruthy(timeLabelConf[timeLabel]);
        });

        contentLabels.map(contentLabel => {
            valid = valid && isTruthy(contentLabelConf[contentLabel]) && (
                contentLabelConf[contentLabel] !== DayOfWeek.NONE);
        });
        setConfIsValid(valid);
    }, [timeLabels, contentLabels, timeLabelConf, contentLabelConf, startDate]);

    const getExpMetaFromRaw = (
        rawItems: object, itemId: string, kind: ItemKind
    ): ExpMetaData => {
        let raw = [];
        switch (kind) {
            case ItemKind.MATERIAL  : raw = rawItems.rawMaterials; break;
            case ItemKind.ASSIGNMENT: raw = rawItems.rawAssignments; break;
        }

        const info: ExpMetaData = {
            title: "Unknown title",
            state: "Unknown state",
            creationTime: null
        };
        for (const it of raw) {
            if (it.id === itemId) {
                info.title = it.title;
                info.state = it.state;
                info.creationTime = new Date(it.creationTime);
                break;
            }
        }
        return info;
    };

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

    const postExportItems = async () => {
        if (!itemsAreValid || !confIsValid) {
            alert("Ensure that you have filled out all timings before exporting");
            return;
        }

        // const startDate = new Date("March 17, 2026 00:00:00");
        const startDoW = startDate.getDay();
        const eItems = [...exportItems];
        for (let i = 0; i < eItems.length; i++) {
            let weeks = Number.parseInt(timeLabelConf[eItems[i].timeLabel]);
            const contentDoW = Number.parseInt(
                contentLabelConf[eItems[i].contentLabel]);
            const diff = contentDoW - startDoW;
            // const day = diff < 0 ? 7 + diff : diff;
            let day;
            if (diff < 0) {
                day = 7 + diff;
            } else {
                day = diff
                weeks--;
            }

            const dt = new Date(startDate.getTime());
            dt.setDate(dt.getDate() + (weeks-1) * 7 + day);
            console.log(startDoW, weeks, contentDoW, dt);
            eItems[i].timing = dt.toISOString();

            eItems[i].locked = true;
        }
        console.log(eItems);
        return;

        const body: ExportTimings = {
            courseId: props.id,
            rawItems: rawItems,
            exportItems: eItems,
        };
        console.log(body);

        const response = await fetch("/api/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json", },
            body: JSON.stringify(body),
        });
        const resJSON = await response.json();
        console.log(resJSON);
    };

    const toggleItemSelected = (itemId: string) => {
        if (selectedIds.includes(itemId)) {
            setSelectedIds(selectedIds.filter(sId => sId !== itemId));
        } else {
            setSelectedIds([...selectedIds, itemId]);
        }
    }

    const addLabelDef = (newLabel: string, kind: LabelKind): boolean => {
        switch (kind) {
            case LabelKind.CONTENT:
                if (newLabel && contentLabels.length < MAX_LABELS
                    && !contentLabels.includes(newLabel)) {
                    setContentLabels([...contentLabels, newLabel]);
                    return true;
                }
                break;

            case LabelKind.TIME:
                if (newLabel && timeLabels.length < MAX_LABELS
                    && !timeLabels.includes(newLabel)) {
                    setTimeLabels([...timeLabels, newLabel]);
                    return true;
                }
                break;

            default:
                console.error(`Unknown kind of label: ${kind}`);
        }
        return false;
    }

    const rmLabelDef = (label: string, kind: LabelKind) => {
        switch (kind) {
            case LabelKind.CONTENT:
                setContentLabels(contentLabels.filter(cLabel => cLabel !== label));
                // Remove content labels from all items (no orphaned labels)
                setExportItems(exportItems.map(eIt => {
                    if (eIt.contentLabel == label) {
                        return {...eIt, contentLabel: null};
                    } else return eIt;
                }));
                break;

            case LabelKind.TIME:
                setTimeLabels(timeLabels.filter(tLabel => tLabel !== label));
                // Remove content labels from all items (no orphaned labels)
                setExportItems(exportItems.map(eIt => {
                    if (eIt.timeLabel == label) {
                        return {...eIt, timeLabel: null};
                    } else return eIt;
                }));
                break;

            default:
                throw new Error(`Unknown kind of label: ${kind}`);
        }
    };

    const rmLabelItem = (itemId: string, label: string, kind: LabelKind) => {
        setExportItems(exportItems.map(eIt => {
            if (eIt.itemId !== itemId) return eIt;
            switch (kind) {
                case LabelKind.CONTENT:
                    return {...eIt, contentLabel: null}

                case LabelKind.TIME:
                    return {...eIt, timeLabel: null}

                default:
                    throw new Error(`Unknown kind of label: ${kind}`);
            }
        }));
    }

    const applyLabelToSelecteds = (label: string, kind: LabelKind) => {
        if (selectedIds.length == 0) {
            console.warn("Nothing is selected to apply");
        }

        setExportItems(exportItems.map(eIt => {
            if (!selectedIds.includes(eIt.itemId)) return eIt;
            switch (kind) {
                case LabelKind.CONTENT:
                    return {...eIt, contentLabel: label};
                case LabelKind.TIME:
                    return {...eIt, timeLabel: label};
                default:
                    throw new Error(`Unknown kind of label: ${kind}`);
            }
        }));

        setSelectedIds([]);
    }

    return (
        <>
            <div className="flex justify-between items-center my-3 p-2">
                <div>
                    <h1 className="text-3xl font-bold">{props.name}</h1>
                    <h2 className="text-md">State: {CourseState[props.state]}</h2>
                </div>

                <div>
                    <button onClick={postExportItems}
                        className={
                            "ml-5 px-7 py-3 rounded " +
                            ((itemsAreValid && confIsValid)
                                ? "bg-green-400 cursor-pointer"
                                : "bg-red-400 cursor-not-allowed")
                        }>
                       Export
                    </button>
                </div>
            </div>

            {/* Labels */}
            <div className="my-4 flex flex-col gap-y-2">
                {/* Time Labels */}
                <div className="">
                    <LabelInput placeholder="New Time Label"
                        addLabel={(newLabel: string) => addLabelDef(
                            newLabel, LabelKind.TIME)} />

                    <div className="my-1 grid grid-cols-8 grid-row-2 gap-1">
                        {timeLabels.map(tLabel => (
                            <Label name={tLabel}
                                rmLabel={() => rmLabelDef(tLabel, LabelKind.TIME)}
                                applyLabel={() => applyLabelToSelecteds(
                                    tLabel, LabelKind.TIME
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Content Labels */}
                <div>
                    <LabelInput placeholder="New Content Label"
                        addLabel={(newLabel: string) => addLabelDef(
                            newLabel, LabelKind.CONTENT)} />

                    <div className="my-1 grid grid-cols-8 grid-row-2 gap-1">
                        {contentLabels.map(cLabel => (
                            <Label name={cLabel}
                                rmLabel={() => rmLabelDef(cLabel, LabelKind.CONTENT)}
                                applyLabel={() => applyLabelToSelecteds(
                                    cLabel, LabelKind.CONTENT
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <details className="outline-2 mb-4" closed>
                <summary className="outline-2 bg-purple-200 p-4 cursor-pointer flex
                    justify-between items-center">
                    Class Items
                    {itemsAreValid
                        ? <BadgeCheck className="stroke-green-500" />
                        : <OctagonX className="stroke-red-500" />
                    }
                </summary>

                <ReactSortable
                    list={exportItems} setList={setExportItems} handle=".handle-grip"
                    className="flex flex-col items-center mt-2" animation={250}
                >
                {
                    exportItems.map(eIt => {
                        const meta = expMetaData[eIt.itemId];
                        return <Item key={eIt.itemId} expItem={eIt}
                            title={meta.title} state={meta.state}
                            contentLabel={eIt.contentLabel} timeLabel={eIt.timeLabel}
                            selected={selectedIds.includes(eIt.itemId)}
                            toggleSelected={() => toggleItemSelected(eIt.itemId)}
                            rmLabel={(name: string, kind: LabelKind) => rmLabelItem(
                                eIt.itemId, name, kind
                            )}
                        />;
                    })
                }
                </ReactSortable>
            </details>

            <details closed>
                <summary className="outline-2 bg-purple-200 p-4 cursor-pointer flex
                    justify-between items-center">
                    Config
                    {confIsValid
                        ? <BadgeCheck className="stroke-green-500" />
                        : <OctagonX className="stroke-red-500" />
                    }
                </summary>

                <div className="outline-2">
                    <div className="flex justify-around items-center p-2 outline-2">
                        <div>
                            Start Date:
                            <input type="date" className="ml-3 border-2 p-1"
                                onBlur={e => {
                                    const d = new Date(e.target.value + " 00:00:00")
                                    if (d.getTime() > new Date().getTime()) {
                                        setStartDate(d);
                                    } else {
                                        alert("Start date has to be in the future");
                                        e.target.value = "";
                                        setStartDate(null);
                                    }
                                }}
                            />
                        </div>

                        <div>
                            <p>
                                Each week starts on <strong>{DayOfWeek[startDate.getDay()]}</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-around">
                        <LabelConfig kind={LabelKind.TIME} labels={timeLabels}
                            labelConf={timeLabelConf}
                            updateLabelConf={setTimeLabelConf}/>
                        <LabelConfig kind={LabelKind.CONTENT} labels={contentLabels}
                            labelConf={contentLabelConf}
                            updateLabelConf={setContentLabelConf}/>
                    </div>
                </div>
            </details>
        </>
    );
}

interface LabelConfig {
    kind: LabelKind;
    labels: string[];
    labelConf: TimeLabelConf | ContentLabelConf;
    updateLabelConf: (conf: TimeLabelConf | ContentLabelConf) => void;
}
function LabelConfig({kind, labels, labelConf, updateLabelConf}: LabelConfigProps) {
    const addValue = (label: string, value: string) => {
        updateLabelConf({...labelConf, [label]: value});
    };

    return (
        <div className="outline-2 w-full px-5 py-2">
            {labels.map(label => (
                <div className="mt-2 flex gap-x-2 justify-between items-center">
                    <span className="inline-block w-1/4">{label}</span>
                    <ConfInput kind={kind} setValue={(val) => addValue(label, val)}
                        _className_="outline-2 flex-grow p-1 inline-block"
                    />
                </div>
            ))}
        </div>
    );
}

interface ExportItemProps {
    expItem: ExporItem;
    title: string;
    state: string;

    contentLabel: string;
    timeLabel: string;
    selected: boolean;

    toggleSelected: () => void;
    rmLabel: (name: string, kind: LabelKind) => void;
}

function Item({
    expItem, title, state, contentLabel, timeLabel, selected, rmLabel, toggleSelected
}: ExportItemProps) {
    const {itemId, kind, locked, timing} = expItem;

    let fill = "bg-blue-300";
    if (kind === ItemKind.MATERIAL) {
        fill = "bg-green-300";
    }

    return (
        <div className={`${fill} outline-2 w-full flex justify-between p-4`}>
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
            <div className="flex gap-2 items-center w-3/10">
                <span className="w-1/2">
                { timeLabel
                    ? <Label name={timeLabel} rmLabel={() => rmLabel(
                        timeLabel, LabelKind.TIME) } />
                    : <EmptyLabel desc="Time" /> }
                </span>
                <span className="w-1/2">
                    { contentLabel
                        ? <Label name={contentLabel} rmLabel={() => rmLabel(
                            contentLabel, LabelKind.CONTENT) } />
                        : <EmptyLabel desc="Content" /> }
                </span>
            </div>

            {/* Right */}
            <div className="flex items-center">
                <button onClick={toggleSelected} className="cursor-pointer">
                    {selected ? <X className="stroke-red-500" /> : <Plus />}
                </button>

                <GripHorizontal
                    className="cursor-grab handle-grip ml-5 active:scale-95" />
            </div>
        </div>
    );
}

interface LabelProps {
    name: string;
    selected: boolean;

    applyLabel: () => void;
    rmLabel: () => void;
}
function Label({name, selected, applyLabel, rmLabel}: LabelProps) {
    return (
        <div className="border-2 border-dotted px-2 py-1 rounded-lg flex
            justify-between">
            <p onClick={applyLabel}
                className={(selected ? "font-bold" : "") + " cursor-pointer"}>
                {name}
            </p>
            <button onClick={rmLabel}>
                <X className="ml-2 stroke-red-400" />
            </button>
        </div>
    );
}

interface EmptyLabelProps { desc: string; }
function EmptyLabel({desc}: string) {
    return (
        <div className="rounded-lg px-2 py-1 border-2 border-dotted border-zinc-500
            text-center text-zinc-800">
            {desc}
        </div>
    )
}

interface LabelInputProps {
    placeholder: string;
    addLabel: (newLabel: string) => boolean;
}
function LabelInput({placeholder, addLabel}: LabelInputProps) {
    const inputRef = useRef(null);
    const addLabelFromInput = () => {
        if (!inputRef.current) return;
        if (addLabel(inputRef.current.value || null))
            inputRef.current.value = null;
    };

    return (
        <div className="flex items-center">
            <input ref={inputRef} type="text" maxlength={7} placeholder={placeholder}
                className="rounded border-2 px-2 py-1 w-1/5" />
            <button onClick={addLabelFromInput}
                className="ml-2 rounded bg-orange-300 px-2 py-1 cursor-pointer">
                <Plus />
            </button>
        </div>
    );
}

interface ConfInputProps {
    kind: LabelKind;
    _className_: string;
    setValue: (val: string | DayOfWeek) => void;
}
function ConfInput({kind, setValue, _className_}: ConfInputProps) {
    let _input_;
    switch (kind) {
        case LabelKind.TIME:
            _input_ = <input placeholder={"# of weeks from start"}
                type="number" className={_className_}
                onBlur={e => setValue(e.target.value)}
            />;
            break;

        case LabelKind.CONTENT:
            _input_ = <DaysOfWeekSelect _className_={_className_}
                action={(dow: DayOfWeek) => setValue(dow)} />
            /*_input_ = <input placeholder={"# of days from week start"}
                type="number" className={_className_} min={0} max={6}
                onBlur={e => {
                    const n = Number.parseInt(e.target.value);
                    if (0 <= n && n <= 6) {
                        setValue(n);
                    } else {
                        alert("Content labels accept values from 0 to 6, inclusive");
                        e.target.value = "";
                    }
                }} />; */
            break;
    }

    return <>{_input_}</>;
}

// TODO: find a better name for this than `action`
interface DaysOfWeekSelectProps {
    _className_: string;
    action: (dow: DayOfWeek) => void;
}
function DaysOfWeekSelect({action, _className_}: DaysOfWeekSelectProps) {
    return (
        <>
            <select onChange={e => action(e.target.value)} className={_className_}>
                <option selected value={DayOfWeek.NONE}>Choose day of week</option>
                <option value={DayOfWeek.SUN}>Sunday</option>
                <option value={DayOfWeek.MON}>Monday</option>
                <option value={DayOfWeek.TUE}>Tuesday</option>
                <option value={DayOfWeek.WED}>Wednesday</option>
                <option value={DayOfWeek.THU}>Thursday</option>
                <option value={DayOfWeek.FRI}>Friday</option>
                <option value={DayOfWeek.SAT}>Saturday</option>
            </select>
        </>
    );
}
