from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Literal
from pprint import pprint
from zoneinfo import ZoneInfo
import copy, json

from gutils import GCWrapper, GCCourse, GCId

# TODO: Instead of hard-coding, this should be determined when this is ran
MY_TIMEZONE = ZoneInfo("America/New_York")
# UTC_TIMEZONE = timezone.utc

@dataclass
class TimeDelta:
    days: int = 0

class Timing:
    def __init__(self, desc: str, locked: bool) -> None:
        self._desc: datetime | TimeDelta

        assert isinstance(desc, str)
        if locked:
            # Absolute timing
            self._desc = datetime.fromisoformat(desc)
        else:
            self._desc = TimeDelta(days=int(desc))

    def to_absolute(self, prev_date: datetime) -> datetime:
        if isinstance(self._desc, datetime):
            return self._desc
        else:
            return prev_date + timedelta(
                days=float(self._desc.days)
            )

def load_timings_conf(
    path: str, model_course_id: str, start: datetime
) -> tuple[dict[GCId, datetime], dict[GCId, dict[str, datetime]]]:
    # TODO: make a method that can find the latest export in the exports/ directory
    with open(path, "r") as f:
        content: dict = json.load(f)

    assert model_course_id == content["courseId"]

    mat_conf, assign_conf = content["materials"], content["assignments"]
    return (
        _load_material_timings(mat_conf, start),
        _load_assignment_timings(assign_conf, start),
    )

def _load_material_timings(
    mat_conf: list[dict], start: datetime
) -> dict[GCId, datetime]:
    timings = [
        Timing(item["timing"], item["locked"]) for item in mat_conf
    ]
    absolutes: list[datetime] = []
    last_absolute = start
    for i in range(len(timings)):
        dt = timings[i].to_absolute(last_absolute)
        absolutes.append(dt)
        last_absolute = dt

    return {
        GCId(item["itemId"]): absolute
        for item, absolute in zip(mat_conf, absolutes)
    }

def _load_assignment_timings(
    assign_conf: list[dict], start: datetime
) -> dict[GCId, dict[str, datetime]]:
    publish_timings: list[Timing] = [
        Timing(item["publish"]["timing"], item["publish"]["locked"])
        for item in assign_conf
    ]
    due_timings: list[Timing | None] = [
        Timing(item["due"]["timing"], item["due"]["locked"])
        if item["due"] is not None else None
        for item in assign_conf
    ]

    assert len(publish_timings) == len(due_timings)

    publish_absolutes: list[datetime] = []
    due_absolutes: list[datetime | None] = []
    last_absolute = start
    for i in range(len(publish_timings)):
        dt = publish_timings[i].to_absolute(last_absolute)
        publish_absolutes.append(dt)
        last_absolute = dt

        due_t = due_timings[i]
        if due_t is not None:
            dt = due_t.to_absolute(last_absolute)
            due_absolutes.append(dt)
            last_absolute = dt
        else:
            due_absolutes.append(None)

    assign_timings = {}
    for item in assign_conf:
        assert len(publish_absolutes) == len(due_absolutes)

        for i in range(len(publish_absolutes)):
            assign_timings[GCId(item["itemId"])] = {
                "publish": publish_absolutes[i],
                "due": due_absolutes[i],
            }

    return assign_timings

def main():
    GCW = GCWrapper()

    model_id = GCW.find_course("Model Class")
    assert model_id is not None
    model: GCCourse = GCW[model_id]
    print("[DEBUG] Found model class")

    actual_start = datetime.now(tz=MY_TIMEZONE)
    actual_id = GCW.find_course("Example Class")
    assert actual_id is not None
    actual: GCCourse = GCW[actual_id]
    print("[DEBUG] Found actual class")

    pprint(model.topics)
    mat_timings, assign_timings = load_timings_conf(
        "sample-timings.json", model_id, actual_start)

    # Step 1: Copy the topics over to `actual`
    for topic in model.topics:
        GCW.create_topic(actual_id, topic)

    print("Completed step 1")

    # Step 2: Setup relationships between model and actual topic ids
    # [MODEL_TOPIC_ID] => ACTUAL_TOPIC_ID
    topic_ids_rel: dict[GCId, GCId] = {}
    assert len(model.topics) == len(actual.topics)
    for i in range(len(model.topics)):
        model_t = model.topics[i]
        for k in range(len(actual.topics)):
            actual_t = actual.topics[k]
            if model_t["name"] == actual_t["name"]:
                topic_ids_rel[model_t["topicId"]] = actual_t["topicId"]

    print("Completed step 2")

    # Step 3: Copy the materials over to `actual`
    for mat in model.materials:
        mat_clone = copy.deepcopy(mat)
        if "topicId" in mat:
            actual_t_id = topic_ids_rel[mat["topicId"]]
            mat_clone["topicId"] = actual_t_id

        mat_clone["scheduledTime"] = mat_timings[mat["id"]].isoformat()
        mat_clone["state"] = "DRAFT"

        GCW.create_material_v2(actual_id, mat_clone)

    print("Completed step 3")

    # # Step 4: Copy the assignments over to `actual`
    # for assign in model.assignments:
    #     assign_clone = copy.deepcopy(assign)
    #     if "topicId" in mat:
    #         actual_t_id = topic_ids_rel[assign["topicId"]]
    #         assign_clone["topicId"] = actual_t_id
    #
    #     for rm_key in ["dueDate", "dueTime", "scheduledTime"]:
    #         assign_clone.pop(rm_key, None)
    #
    #     scheduledTime = patch_timing()
    #
    #     GCW.create_assignment_v2(actual_id, assign_clone)
    #
    # print("Completed step 4")

if __name__ == "__main__":
    main()

    # GCW = GCWrapper()
    # model_id = GCW.find_course("Model Class")
    # assert model_id is not None
    # actual_start = datetime.now()
    # mat_timings, assign_timings = load_timings_conf("sample-timings.json", model_id, actual_start)
    #
    # pprint(mat_timings)
    # print("\n\n")
    # pprint(assign_timings)
