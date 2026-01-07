# Original Code Source: https://github.com/googleworkspace/python-samples/blob/main/classroom/quickstart/quickstart.py
# LICENSE: the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

# Resources:
#   - https://developers.google.com/workspace/classroom/reference/rest
#   - https://developers.google.com/workspace/drive/api/reference/rest/v3

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import json, os, pprint

from google.auth.exceptions import MutualTLSChannelError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

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

def gc_find_course(name: str) -> str | None:
    """Provided a course name, return its course id"""
    try:
        results = GC_SERVICE.courses().list(pageSize=10).execute()

        # NOTE: for now, I don't forsee having that many classes that the next page
        # attribute is required
        # TODO: handle next page, if provided here
        for course in results["courses"]:
            if course["name"] == name:
                return course["id"]

        return None
    except HttpError as error:
        print(f"An error occurred: {error}")

def gd_find_file(name: str) -> str | None:
    """Search a file, if found, return file id.

    *NOTE*: An exact name is required!!"""
    # TODO: [possible extension] Instead of requiring the exact file name, take advantage of
    # the search queries ('contains', 'filetype')
    try:
        results = GD_SERVICE.files().list(
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
        print(f"An error occurred: {error}")


def gc_find_topic(course_id: str, name: str) -> str | None:
    try:
        """Search for a topic, if found, return its id"""
        results = GC_SERVICE.courses().topics().list(
            courseId=course_id, pageSize=10).execute()

        for topic in results["topic"]:
            if topic["name"] == name:
                return topic["topicId"]

        return None
    except HttpError as error:
        print(f"An error occurred: {error}")


# Resource: https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials
def gc_create_material(
    course_id: str,
    title: str,
    scheduled_time: datetime,
    drive_file_ids: list[str],
    topic: str = "",
    description: str = "",
    # publish: bool = True,
) -> None:
    """Create a material with provided info"""
    scheduled_time_tz = scheduled_time.replace(tzinfo=MY_TIMEZONE)
    material = {
        "courseId": course_id,
        "title": title,
        "description": None if len(description) == 0 else description,
        "materials": [
            { "driveFile": { "driveFile": {"id": file_id } } } for file_id in drive_file_ids
        ],
        # "state": "PUBLISHED" if publish else "DRAFT",
        # NOTE: In order to use scheduled time attribute, the status has to be 'DRAFT'.
        "state": "DRAFT",
        "scheduledTime": scheduled_time_tz.isoformat(),
        "topicId": gc_find_topic(course_id, topic)
    }

    try:
        results = GC_SERVICE.courses().courseWorkMaterials().create(
            courseId=course_id, body=material).execute()
    except HttpError as error:
        print(f"An error occurred: {error}")


# Resource: https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials
def gc_create_assignment(
    course_id: str,
    title: str,
    scheduled_time: datetime,
    due_date: datetime,
    mat_drive_file_ids: list[str] = [],
    asg_drive_file_ids: list[str] = [],
    topic: str = "",
    description: str = "",
    max_points: int = 100,
    # publish: bool = True,
) -> None:
    """Create a material with provided info"""
    scheduled_time_tz = scheduled_time.replace(tzinfo=MY_TIMEZONE)
    due_date_utc = due_date.replace(tzinfo=UTC_TIMEZONE)

    course_work = {
        "courseId": course_id,
        "title": title,
        "description": description,
        "materials": [
            { "driveFile": { "driveFile": {"id": file_id } } } for file_id in mat_drive_file_ids
        ],
        # NOTE: In order to use scheduled time attribute, the status has to be 'DRAFT'.
        "state": "DRAFT",
        "dueDate": {
            "year": due_date_utc.year,
            "month": due_date_utc.month,
            "day": due_date_utc.day,
        },
        "dueTime": {
            "hours": due_date_utc.hour,
            "minutes": due_date_utc.minute,
            "seconds": due_date_utc.second,
            "nanos": int(due_date_utc.microsecond / 1000)
        },
        "scheduledTime": scheduled_time_tz.isoformat(),
        "maxPoints": max_points,
        "workType": "ASSIGNMENT",
        # TODO: make this configurable
        "assigneeMode": "ALL_STUDENTS",
        "submissionModificationMode": "MODIFIABLE_UNTIL_TURNED_IN",
        "topicId": gc_find_topic(course_id, topic),
    }

    try:
        results = GC_SERVICE.courses().courseWork().create(
            courseId=course_id, body=course_work).execute()
    except HttpError as error:
        print(f"An error occurred: {error}")


if __name__ == "__main__":
    results = GD_SERVICE.files().get(fileId="0AFMLwX8-ERlYUk9PVA").execute()
    with open("test2.json", "w") as f:
        json.dump(results, f, indent=4)
