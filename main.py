from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Literal
from pprint import pprint
import json

from gutils import GC, GD

# TODO: add feature to edit existing courses details

@dataclass
class TimeDelta:
    weeks: int = 0
    days: int = 0

class TimeInfo:
    def __init__(self, desc: str | dict) -> None:
        self._desc: datetime | TimeDelta

        if isinstance(desc, str):
            self._desc = datetime.fromisoformat(desc)
        elif isinstance(desc, dict):
            self._desc = TimeDelta(**desc)
        else:
            raise TypeError(f"Time description was of unknown type: {type(desc)}")

    def to_absolute(self, prev_date: datetime) -> datetime:
        if isinstance(self._desc, datetime):
            return self._desc
        else:
            return prev_date + timedelta(
                weeks=float(self._desc.weeks),
                days=float(self._desc.days)
            )


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
    topic: str
    title: str
    publish_at: TimeInfo

    # Optional attributes
    description: str | None = None
    files: list[str] | None = None
    due_at: TimeInfo | None = None
    max_points: int | None = None

    def __post_init__(self):
        assert self.kind in ["material", "assignment"], (
            f"Unknown kind of work: ({self.kind})"
        )

    def get_due_date(self, curr_pub_date: datetime) -> datetime | None:
        # NOTE: Only assignments can have due dates
        # TODO: I might have to add specific stipulations for quiz assignments
        if self.kind != "assignment": return
        # NOTE: Not all assignments have to have a due-date
        if self.due_at is None: return

        return self.due_at.to_absolute(curr_pub_date)

    def get_publish_date(self, prev_pub_date: datetime) -> datetime:
        return self.publish_at.to_absolute(prev_pub_date)


class CourseInfo:
    def __init__(self, name: str, start_date: datetime) -> None:
         c_id = GC.find_course(name)
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
        for w_i in cinfo.work_items:
            pprint(asdict(w_i))
            print("-------------------------")

        return cinfo

    def make_requests(self) -> None:
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
                        f_id = GD.find_file(file)
                        if f_id: mat_drive_file_ids.append(f_id)

                    assert due_date is not None, "Due date can't be none for an assignment"
                    GC.create_assignment(
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
                        f_id = GD.find_file(file)
                        if f_id: drive_file_ids.append(f_id)

                    GC.create_material(
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

ci = CourseInfo.from_json("DONT_USE_sample-course-setup.json")
