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
    title: str
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

    def get_due_date(self, curr_pub_date: datetime) -> datetime | None:
        if self.kind != "assignment": return
        if self.due_after is None: return
        # NOTE: At this point, there is a due date (it's obvious but why not write it down...)
        if self.due_date is not None: return self.due_date

        return curr_pub_date + timedelta(
            weeks=float(self.due_after.weeks),
            days=float(self.due_after.days)
        )

    def get_publish_date(self, prev_pub_date: datetime) -> datetime:
        if self.publish_date is not None: return self.publish_date

        return prev_pub_date + timedelta(
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

        start_date: datetime = datetime.fromisoformat(info["start_date"])
        assert start_date > datetime.now(), "Course start date has to be in the future."
        cinfo = cls(info["name"], start_date)
        cinfo.work_items = [WorkInfo(**item) for item in info["items"]]
        return cinfo

    def setup_course(self) -> None:
        prev_pub_date: datetime = self.start_date
        for work in self.work_items:
            pub_date: datetime = work.get_publish_date(prev_pub_date)
            match work.kind:
                case "assignment":
                    due_date = work.get_due_date(pub_date)
                    mat_drive_file_ids: list[str] = []
                    assert work.files, (
                        "Material has no associated files; if intentional, then just make a post instead"
                    )

                    for file in work.files:
                        f_id = gutils.gd_find_file(file)
                        if f_id: mat_drive_file_ids.append(f_id)

                    assert due_date is not None, "Due date can't be none for an assignment"
                    gutils.gc_create_assignment(
                        self.course_id,
                        work.title,
                        pub_date,
                        due_date,
                        mat_drive_file_ids=mat_drive_file_ids,
                        topic=work.topic,
                        description=work.description,
                        max_points=work.max_points,
                    )

                case "material":
                    assert work.files, (
                        "Material has no associated files; if intentional, then just make a post instead"
                    )

                    drive_file_ids: list[str] = []
                    for file in work.files:
                        f_id = gutils.gd_find_file(file)
                        if f_id: drive_file_ids.append(f_id)

                    gutils.gc_create_material(
                        self.course_id,
                        work.title,
                        pub_date,
                        drive_file_ids,
                        topic=work.topic,
                        description=work.description,
                    )
                case _:
                    raise ValueError(f"Unknown work kind: {work.kind}")

            prev_pub_date = pub_date

CourseInfo.from_json("sample-course-setup.json").setup_course()
