import { Fragment, render } from "preact";
import { useState, useEffect } from "preact/hooks";
// import "./index.css";

import { ReactSortable } from "react-sortablejs";
import { GripHorizontal, Lock } from "lucide-react";

enum ItemKind {
    Material,
    Assignment,
}

interface ItemProps {
    kind: ItemKind;
    title: string;
    state: string;
    topicId: string
}

function Item(props) {
    return (
        <div>
            <GripHorizontal className="handle-grip" />
            {props.title} | {props.state} | {props.kind}
            <Lock />
        </div>
    );
}

export default function App() {
    const [itemList, setItemList] = useState<ItemProps[]>([]);

    useEffect(() => {
        const fetchAndSetItems = async () => {
            const res = await fetch("./sample-items.json");
            const resJson = await res.json();

            const items: ItemProps[] = [];
            for (const mat of resJson?.materials) {
                items.push({
                    id: mat.id,
                    kind: ItemKind.Material,
                    title: mat.title,
                    state: mat.state,
                    topicId: mat.topicId
                });
            }

            for (const assign of resJson?.assignments) {
                items.push({
                    id: assign.id,
                    kind: ItemKind.Assignment,
                    title: assign.title,
                    state: assign.state,
                    topicId: assign.topicId
                });
            }

            setItemList(items);
        };

        fetchAndSetItems();
    }, []);

    return <Fragment>
        <nav>
            <input type="date" />
            <input type="time" />
            <input type="submit" value="Submit" />
        </nav>

        <ReactSortable list={itemList} setList={setItemList} handle=".handle-grip" >
        {
            itemList.map((itemProps, i) =>
                <Item key={i} {...itemProps} />
            )
        }
        </ReactSortable>
    </Fragment>

}

render(<App />, document.getElementById("app"))
