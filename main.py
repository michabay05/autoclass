from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal
import json

import gutils

@dataclass
class TimeDelta:
    weeks: int = 0
    days: int = 0

WorkType = Literal["material", "assignment"]
# NOTE: For any given work, there are multiple ways to represent the dates.
# It can be represented using absolute or relative dates. Technically, only
# one method should be used to describe dates. However, in the event that
# both forms are used, the absolute dates are preferred. With that said, when
# specifying work via the json, the relative publish date is required as relative
# date specs is easier to wrestle with.
@dataclass
class WorkInfo:
    kind: WorkType
    publish_after: TimeDelta
    topic: str
    name: str
    publish_date: datetime | None = None
    description: str | None = None
    files: list[str] | None = None
    due_after: TimeDelta | None = None
    due_date: datetime | None = None
    max_points: int | None = None

    def __post_init__(self):
        assert self.kind in ["material", "assignment"], (
            f"Unknown kind of work: ({self.kind})"
        )

        if isinstance(self.publish_date, str):
            self.publish_date = datetime.fromisoformat(self.publish_date)

        if isinstance(self.due_date, str):
            self.due_date = datetime.fromisoformat(self.due_date)

        if isinstance(self.publish_after, dict):
            self.publish_after = TimeDelta(**self.publish_after)

        if isinstance(self.due_after, dict):
            self.due_after = TimeDelta(**self.due_after)

    def get_due_date(self, prev_date: datetime) -> datetime | None:
        if self.due_after is None: return
        # NOTE: At this point, there is a due date (it's obvious but why not write it down...)
        if self.due_date is not None: return self.due_date

        return prev_date + timedelta(
            weeks=float(self.due_after.weeks),
            days=float(self.due_after.days)
        )

    def get_publish_date(self, prev_date: datetime) -> datetime:
        if self.publish_date is not None: return self.publish_date

        return prev_date + timedelta(
            weeks=float(self.publish_after.weeks),
            days=float(self.publish_after.days)
        )


class CourseInfo:
    def __init__(self, name: str, start_date: datetime) -> None:
         c_id = gutils.gc_find_course(name)
         assert c_id is not None, f"ERROR: Unable to find course with name: '{name}'"
         self.course_id: str = c_id
         self.start_date: datetime = start_date
         self.work_items: list[WorkInfo] = []

    @classmethod
    def from_json(cls, json_path: str) -> 'CourseInfo':
        with open(json_path, "r") as f:
            info = json.load(f)

        cinfo = cls(info["name"], datetime.fromisoformat(info["start_date"]))
        cinfo.work_items = [WorkInfo(**item) for item in info["items"]]
        return cinfo

    def setup_course(self) -> None:
        pass
