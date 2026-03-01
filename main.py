from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Literal
from pprint import pprint
import json

from gutils import GCWrapper, GCAssignment, GCMaterial

# TODO: add feature to edit existing courses details

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


@dataclass
class TimingImportItem:
    itemId: str
    kind: str
    locked: bool
    timing: str

# @dataclass
# class ItemRequest:
#     course_id: str,
#     title: str,
#     scheduled_time: datetime,
#     topic: str | None = None,
#     description: str | None = None,
#     drive_file_ids: list[str],
#
#     args:
#         due_date: datetime,
#         max_points: int | None = 100,

def export_items(path: str) -> None:
    # TODO: make a method that can find the latest export in the exports/ directory
    with open(path, "r") as f:
        content: dict = json.load(f)

    print(content["courseId"])
    items = [TimingImportItem(**itemProps) for itemProps in content["items"]]

GC = GCWrapper(import_path="exports/export-02-2026.json")

if __name__ == "__main__":
    course = GC.find_course("Model Class")
    assert course is not None
    with open("test.json", "r") as f:
        GC.create_material_v2(course, GCMaterial(**json.load(f)))
