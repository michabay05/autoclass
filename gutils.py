# Original Code Source: https://github.com/googleworkspace/python-samples/blob/main/classroom/quickstart/quickstart.py
# LICENSE: the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

# Resources:
#   - https://developers.google.com/workspace/classroom/reference/rest
#   - https://developers.google.com/workspace/drive/api/reference/rest/v3
#   - [Google Python API Client Docs]:
#       - Root: https://github.com/googleapis/google-api-python-client/blob/main/docs/dyn/index.md
#       - Classroom v1: https://googleapis.github.io/google-api-python-client/docs/dyn/classroom_v1.html
#       - Drive v3: https://googleapis.github.io/google-api-python-client/docs/dyn/drive_v3.html

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Literal
from pprint import pprint
import json, os

from google.auth.exceptions import MutualTLSChannelError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
# NOTE: The Google Classroom API service is of type Resource
#   >> from googleapiclient.discovery import Resource
from googleapiclient.errors import HttpError

# TODO: Look into batch requests here if the amount grows too large
# Source: https://googleapis.github.io/google-api-python-client/docs/batch.html

# NOTE: Whenever these scopes are modified, delete the token.json file to apply changed effects.
SCOPE_LIST = [
    "classroom.courses",
    "classroom.topics",
    "classroom.coursework.students",
    "classroom.courseworkmaterials",
    "classroom.coursework.me",
    "drive.readonly"
]

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
        # gc_service = build("classroom", "v1", credentials=creds)
        # gd_service = build("drive", "v3", credentials=creds)
        # return gc_service, gd_service

        gc_service = build("classroom", "v1", credentials=creds)
        return gc_service
    except MutualTLSChannelError as err:
        print(err)
        # NOTE: This is a temporary fix for dev purposes
        assert False


GCCourseState = Literal["ACTIVE", "ARCHIVED", "COURSE_STATE_UNSPECIFIED"]
GCId = str
GCTopic = dict
GCMaterial = dict
GCAssignment = dict

@dataclass
class GCCourseInfo:
    id: str
    name: str
    enrollmentCode: str
    # NOTE: Not all course states have been created here because I don't really care
    # about the rest.
    courseState: GCCourseState

@dataclass
class GCCourse:
    info: GCCourseInfo

    topics: list[GCTopic] = field(default_factory=list)
    materials: list[GCMaterial] = field(default_factory=list)
    assignments: list[GCAssignment] = field(default_factory=list)

    def populate(self, service) -> None:
        self.topics = self._list_topics(service)
        self.materials = self._list_materials(service)
        self.assignments = self._list_assignments(service)

    def find_topic(self, name: str | None) -> GCTopic | None:
        if name is None: return None

        for topic in self.topics:
            if topic["name"] == name:
                return topic

        return None

    def _list_topics(self, service) -> list[GCTopic]:
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses.topics/list

        try:
            results = service.courses().topics().list(
                courseId=self.info.id
            ).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        return results.get("topic", [])

    def _list_materials(self, service) -> list[GCMaterial]:
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials/list

        try:
            results = service.courses().courseWorkMaterials().list(
                courseId=self.info.id,
                # asc - ascending order
                # desc - descending order
                orderBy="updateTime asc",
            ).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        return results.get("courseWorkMaterial", [])

    def _list_assignments(self, service) -> list[GCAssignment]:
        # NOTE: (Link) https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list

        try:
            results = service.courses().courseWork().list(
                courseId=self.info.id,
                # asc - ascending order
                # desc - descending order
                orderBy="updateTime asc",
                courseWorkStates=["PUBLISHED", "DRAFT"]
            ).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        return results.get("courseWork", [])


class GCWrapper:
    def __init__(self, import_path: str | None = None) -> None:
        print("[INFO] Setting up Google classroom API service...")
        self._service = gservice_setup()
        print("[DEBUG] Done setting up Classroom service...")

        self._courses: dict[GCId, GCCourse] = {}
        self._import_path: str | None = None

        if (import_path is None) or (not os.path.exists(import_path)):
            print("[WARN] No import provided OR import path does not exist.")
            # NOTE: (key, value) -> (id, course)
            self._courses = self._list_courses()
            self._import_path = None

            self.export_all_info()
        else:
            self._import_path = import_path
            with open(import_path, "r") as f:
                c_info = json.load(f)["allItems"]

            for course_id in c_info:
                course = c_info[course_id]
                course_info = GCCourseInfo(**course["info"])
                self._courses[course_id] = GCCourse(
                    info=course_info,
                    topics=course["topics"],
                    materials=course["materials"],
                    assignments=course["assignments"],
                )

    def __getitem__(self, key: GCId) -> GCCourse:
        assert isinstance(key, GCId)
        return self._courses[key]

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
            c = GCCourse(
                info=GCCourseInfo(
                    id=course["id"],
                    name=course["name"],
                    enrollmentCode=course["enrollmentCode"],
                    courseState=course["courseState"]
                )
            )

            c.populate(self._service)

            output[course["id"]] = c

        return output

    def find_course(self, name: str) -> GCId | None:
        for course in self._courses.values():
            if course.info.name == name:
                return course.info.id

        return None

    def create_course(self, name: str, owner_id: str = "me") -> GCId:
        in_info = { "name": name, "ownerId": owner_id }

        try:
            results = self._service.courses().create(body=in_info).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")
            assert False

        new_course_id = results["id"]
        self._courses[new_course_id] = GCCourse(
            info=GCCourseInfo(
                id=new_course_id,
                name=results["name"],
                enrollmentCode=results["enrollmentCode"],
                courseState=results["courseState"],
            )
        )

        return new_course_id

    def create_assignment_v2(self, course_id: GCId, assignment: GCAssignment) -> None:
        try:
            results = self._service.courses().courseWork().create(
                courseId=course_id, body=assignment).execute()
        except HttpError as error:
            print(f"An HTTP error occurred: {error}")

        self[course_id].assignments.append(results)

    def create_material_v2(self, course_id: GCId, material: GCMaterial) -> None:
        try:
            results = self._service.courses().courseWorkMaterials().create(
                courseId=course_id, body=material).execute()
        except HttpError as error:
            assert False, f"An HTTP error occurred: {error}"

        self[course_id].materials.append(results)

    def create_topic(self,
        course_id: GCId, topic: GCTopic, skip_if_exists: bool = True
    ) -> None:
        if skip_if_exists:
            for c_topic in self[course_id].topics:
                if c_topic["name"] == topic["name"]: return

        try:
            results = self._service.courses().topics().create(
                courseId=course_id, body=topic).execute()
        except HttpError as error:
            assert False, f"An HTTP error occurred: {error}"

        self[course_id].topics.append(results)

    def export_all_info(self) -> None:
        now = datetime.now()
        out_json_path = f"exports/export-{now.month:02}-{now.year}.json"

        all_course_info = {}
        for course_id in self._courses:
            all_course_info[course_id] = asdict(self._courses[course_id])

        with open(out_json_path, "w") as f:
            out_dict = {
                "exportDate": str(now),
                "allItems": all_course_info
            }
            json.dump(out_dict, f, indent=4)

