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

