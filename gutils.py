# Original Code Source: https://github.com/googleworkspace/python-samples/blob/main/classroom/quickstart/quickstart.py
# LICENSE: the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

# Resources:
#   - https://developers.google.com/workspace/classroom/reference/rest
#   - https://developers.google.com/workspace/drive/api/reference/rest/v3
#   - [Google Python API Client Docs]:
#       - Root: https://github.com/googleapis/google-api-python-client/blob/main/docs/dyn/index.md
#       - Classroom v1: https://googleapis.github.io/google-api-python-client/docs/dyn/classroom_v1.html
#       - Drive v3: https://googleapis.github.io/google-api-python-client/docs/dyn/drive_v3.html

from dataclasses import dataclass, field
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Literal
from pprint import pprint
import json, os

from google.auth.exceptions import MutualTLSChannelError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# TODO: Look into batch requests
# Source: https://googleapis.github.io/google-api-python-client/docs/batch.html

# NOTE: prefix 'gc-' -> Google Classroom
#       prefix 'gd-' -> Google Drive

# NOTE: Whenever these scopes are modified, delete the token.json file to apply changed effects.
SCOPE_LIST = [
    "classroom.courses",
    "classroom.topics",
    "classroom.coursework.students",
    "classroom.courseworkmaterials",
    "classroom.coursework.me",
    "drive.readonly"
]
# TODO: Instead of hard-coding, this should be determined when this is ran
MY_TIMEZONE = ZoneInfo("America/New_York")
UTC_TIMEZONE = timezone.utc

def gservice_setup(cred_path: str = "credentials.json", token_path: str = "token.json"):
    creds = None
    base_url = "https://www.googleapis.com/auth/"
    scopes = [f"{base_url}{scope}" for scope in SCOPE_LIST]
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, scopes)

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(cred_path, scopes)
            creds = flow.run_local_server(port=0)
            # Save the credentials for the next run
            with open(token_path, "w") as token:
                token.write(creds.to_json())

    try:
        gc_service = build("classroom", "v1", credentials=creds)
        gd_service = build("drive", "v3", credentials=creds)
        return gc_service, gd_service
    except MutualTLSChannelError as err:
        print(err)
        # NOTE: This is a temporary fix for dev purposes
        assert False

GC_SERVICE, GD_SERVICE = gservice_setup()

GCCourseState = Literal["ACTIVE", "ARCHIVED", "COURSE_STATE_UNSPECIFIED"]
GCMaterialState = Literal["PUBLISHED", "DRAFTED", "DELETED", "COURSEWORK_MATERIAL_STATE_UNSPECIFIED"]
GCMaterialShareMode = Literal["VIEW", "EDIT", "STUDENT_COPY", "UNKNOWN_SHARE_MODE"]
GCAssignmentType = Literal[
    "COURSE_WORK_TYPE_UNSPECIFIED", "ASSIGNMENT",
    "SHORT_ANSWER_QUESTION", "MULTIPLE_CHOICE_QUESTION"
]
GCId = str
GCMaterialItem = dict
GCAssignmentDetail = dict
GCAssignmentMCDetail = dict
GDId = str

@dataclass
class GCCourseInfo:
    id: str
    name: str
    enrollmentCode: str
    # NOTE: Not all course states have been created here because I don't really care
    # about the rest.
    courseState: GCCourseState

@dataclass
class GCTopic:
    courseId: str
    topicId: str
    name: str

@dataclass
class GCSharedDriveFile:
    drive_res_id: GDId
    share_mode: GCMaterialShareMode

@dataclass
class GCDate:
    year: int
    month: int
    day: int

@dataclass
class GCTimeOfDay:
    hours: int
    minutes: int
    seconds: int
    nanos: int

@dataclass
class GCMaterial:
    courseId: str
    id: str
    title: str
    state: GCMaterialState
    materials: list[GCMaterialItem]
    topicId: str | None = None
    description: str | None = None

    # TODO: Consider if the following information is useful to store
    #  - Creation time
    #  - Update time
    #  - Scheduled time

    # TODO: Consider if having a way to limit which students view this is important

@dataclass
class GCAssignment:
    courseId: str
    id: str
    title: str
    state: GCMaterialState

    dueDate: GCDate | None = None
    dueTime: GCTimeOfDay | None = None
    materials: list[GCMaterialItem] | None = None
    # NOTE: `None` or 0 implies ungraded
    maxPoints: int | None = None
    topicId: str | None = None
    description: str | None = None

    assignment: GCAssignmentDetail | None = None
    multipleChoiceQuestion: GCAssignmentMCDetail | None = None


@dataclass
class GCCourse:
    # NOTE: (key, value) -> (course, topics[])
    info: GCCourseInfo
    topics: list[GCTopic] = field(default_factory=list)
    materials: list[GCMaterial] = field(default_factory=list)
    assignments: list[GCAssignment] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.topics = self._list_topics()
        self.materials = self._list_materials()
        self.assignments = self._list_assignments()

    def find_topic(self, name: str | None) -> GCTopic | None:
        if name is None: return None

        for topic in self.topics:
            if topic.name == name:
                return topic

        return None

    def _list_topics(self) -> list[GCTopic]:
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses.topics/list

        try:
            results = GC_SERVICE.courses().topics().list(
                courseId=self.info.id
            ).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        if "topic" not in results.keys():
            return []

        output: list[GCTopic] = []
        for topic in results["topic"]:
            output.append(GCTopic(
                courseId=topic["courseId"],
                topicId=topic["topicId"],
                name=topic["name"],
            ))

        return output

    def _list_materials(self) -> list[GCMaterial]:
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials/list

        try:
            results = GC_SERVICE.courses().courseWorkMaterials().list(
                courseId=self.info.id,
                # asc - ascending order
                # desc - descending order
                orderBy="updateTime asc",
            ).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        if "courseWorkMaterial" not in results.keys():
            return []

        output: list[GCMaterial] = []
        for material in results["courseWorkMaterial"]:
            desc: str | None = None
            if "description" in material:
                desc = material["description"]

            topic_id: str | None = None
            if "topicId" in material:
                topic_id = material["topicId"]

            output.append(GCMaterial(
                courseId=material["courseId"],
                id=material["id"],
                title=material["title"],
                description=desc,
                state=material["state"],
                topicId=topic_id,
                materials=material["materials"]
            ))

        return output

    def _list_assignments(self) -> list[GCAssignment]:
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list

        try:
            results = GC_SERVICE.courses().courseWork().list(
                courseId=self.info.id,
                # asc - ascending order
                # desc - descending order
                orderBy="updateTime asc",
            ).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        if "courseWork" not in results.keys():
            return []

        output: list[GCAssignment] = []
        for assignment in results["courseWork"]:
            max_pts: str | None = None
            if "maxPoints" in assignment:
                max_pts = assignment["maxPoints"]

            desc: str | None = None
            if "description" in assignment:
                desc = assignment["description"]

            topic_id: str | None = None
            if "topicId" in assignment:
                topic_id = assignment["topicId"]

            assign_detail: GCAssignmentDetail | None = None
            if "assignment" in assignment:
                assign_detail = assignment["assignment"]

            mcq: GCAssignmentMCDetail | None = None
            if "multipleChoiceQuestion" in assignment:
                mcq = assignment["multipleChoiceQuestion"]

            mats: list[GCMaterialItem] | None = None
            if "materials" in assignment:
                mats = assignment["materials"]

            due_date: GCDate | None = None
            if "dueDate" in assignment:
                mats = assignment["dueDate"]

            due_time: GCTimeOfDay | None = None
            if "dueTime" in assignment:
                due_time = assignment["dueTime"]

            output.append(GCAssignment(
                courseId=assignment["courseId"],
                id=assignment["id"],
                title=assignment["title"],
                state=assignment["state"],

                dueDate=due_date,
                dueTime=due_time,
                materials=mats,
                maxPoints=max_pts,
                topicId=topic_id,
                description=desc,
                assignment=assign_detail,
                multipleChoiceQuestion=mcq
            ))

        return output



class GCWrapper:
    def __init__(self) -> None:
        self._service = GC_SERVICE
        # NOTE: (key, value) -> (id, course)
        self._courses: dict[GCId, GCCourse] = self._list_courses()

    def _list_courses(self) -> dict[GCId, GCCourse]:
        """Provided a course name, return its course id"""
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses/list

        try:
            results = self._service.courses().list().execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        if "nextPageToken" in results.keys():
            # NOTE: for now, I don't forsee having that many classes that the next page attribute is required
            # TODO: implement pagination
            raise NotImplementedError("'nextPageToken' has not been handled so far")

        assert len(results["courses"]) > 0, (
            "No course found on this account. Try again.")

        output: dict[GCId, GCCourse] = {}
        for course in results["courses"]:
            output[course["id"]] = GCCourse(
                info=GCCourseInfo(
                    id=course["id"],
                    name=course["name"],
                    enrollmentCode=course["enrollmentCode"],
                    courseState=course["courseState"]
                )
            )

        return output

    # TODO: deprecate this function
    def OLD_find_course(self, name: str) -> str | None:
        """Provided a course name, return its course id"""
        try:
            results = self._service.courses().list(pageSize=10).execute()

            # NOTE: for now, I don't forsee having that many classes that the next page
            # attribute is required
            # TODO: handle next page, if provided here
            for course in results["courses"]:
                if course["name"] == name:
                    return course["id"]

            return None
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

    def find_course(self, name: str) -> GCId | None:
        for course in self._courses.values():
            if course.info.name == name:
                return course.info.id

        return None

    def OLD_find_topic(self, course_id: GCId, name: str | None) -> str | None:
        if not name: return

        try:
            """Search for a topic, if found, return its id"""
            results = self._service.courses().topics().list(
                courseId=course_id, pageSize=10).execute()

            for topic in results["topic"]:
                if topic["name"] == name:
                    return topic["topicId"]
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

    # Resource: https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials
    def create_material(self,
        course_id: str,
        title: str,
        scheduled_time: datetime,
        drive_file_ids: list[str],
        topic: str | None = None,
        description: str | None = None,
        # publish: bool = True,
    ) -> None:
        """Create a material with provided info"""
        scheduled_time_tz = scheduled_time.replace(tzinfo=MY_TIMEZONE)
        material = {
            "courseId": course_id,
            "title": title,
            "description": description,
            "materials": [
                { "driveFile": { "driveFile": {"id": file_id } } } for file_id in drive_file_ids
            ],
            # "state": "PUBLISHED" if publish else "DRAFT",
            # NOTE: In order to use scheduled time attribute, the status has to be 'DRAFT'.
            "state": "DRAFT",
            "scheduledTime": scheduled_time_tz.isoformat(),
        }
        topic_id = self._courses[course_id].find_topic(topic)
        if topic_id is not None:
            material["topicId"] = topic_id

        try:
            results = self._service.courses().courseWorkMaterials().create(
                courseId=course_id, body=material).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")


    # Resource: https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials
    def create_assignment(self,
        course_id: GCId,
        title: str,
        scheduled_time: datetime,
        due_date: datetime,
        mat_drive_file_ids: list[str] | None = None,
        topic: str | None = None,
        description: str | None = None,
        max_points: int | None = 100,
        # publish: bool = True,
    ) -> None:
        """Create a material with provided info"""
        scheduled_time_tz = scheduled_time.replace(tzinfo=UTC_TIMEZONE)
        due_date_utc = due_date.replace(tzinfo=UTC_TIMEZONE)
        submit_dir_id = GD.find_file("TestDir")
        assert submit_dir_id is not None, "All assignments have to have a submission directory"
        topic_id = self._courses[course_id].find_topic(topic)
        assert topic_id is not None, "For now, all topics for assignments have to exist; they can't be omitted."

        course_work = {
            "courseId": course_id,
            "title": title,
            "description": description,
            "materials": [
                { "driveFile": { "driveFile": {"id": file_id } } } for file_id in mat_drive_file_ids
            ] if mat_drive_file_ids else [],
            "dueDate": {
                "year": due_date_utc.year,
                "month": due_date_utc.month,
                "day": due_date_utc.day,
            },
            "dueTime": {
                "hours": due_date_utc.hour,
                "minutes": due_date_utc.minute,
                "seconds": due_date_utc.second,
            },
            "scheduledTime": scheduled_time_tz.isoformat(),
            # NOTE: In order to use scheduled time attribute, the status has to be 'DRAFT'.
            "state": "DRAFT",
            "maxPoints": max_points,
            "workType": "ASSIGNMENT",
            # TODO: make this configurable (maybe not though)
            "assigneeMode": "ALL_STUDENTS",
            "submissionModificationMode": "MODIFIABLE_UNTIL_TURNED_IN",
            "topicId": topic_id,
        }

        try:
            results = self._service.courses().courseWork().create(
                courseId=course_id, body=course_work).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")


class GDWrapper:
    def __init__(self) -> None:
        self._service = GD_SERVICE

    def find_file(self, name: str) -> str | None:
        """Search a file, if found, return file id.

        *NOTE*: An exact name is required!!"""
        # TODO: [possible extension] Instead of requiring the exact file name, take advantage of
        # the search queries ('contains', 'filetype')
        try:
            results = self._service.files().list(
                pageSize=10, spaces="drive", q=f"name = '{name}'",
                fields="nextPageToken, files(id, name, parents)",
                # NOTE: I hope this won't be a problem at some point
                includeItemsFromAllDrives=False
            ).execute()
            n = len(results["files"])
            if n == 0:
                # No results found
                print(f"Found 0 files with name: '{name}'")
                return None

            if n > 1:
                # Too many results found
                print(f"Found {n} files with name: '{name}'")

            return results["files"][0]["id"]
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")


GC = GCWrapper()
GD = GDWrapper()

if __name__ == "__main__":
    course = GC.find_course("Model Class")
    assert course is not None

    with open("test.txt", "w") as f:
        pprint(GC._courses[course], stream=f, indent=4)
