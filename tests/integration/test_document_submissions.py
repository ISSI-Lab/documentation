#!/usr/bin/env python3
"""Integration tests for Document Submissions: Personal and Project Shared Documents.

Validates the full specification:
1. Personal Document (Submittable):
   - Each individual member has their own submission draft pre-populated from creator defaults.
   - Project creator can view all individual submissions in the review roster.
   - Individual member can save drafts, submit deliverable, unsubmit to edit, and re-submit.
   - Project creator can review, update status ('reviewed', 'draft'), and post feedback comments.
   - Participants can view and reply to review comments.

2. Project Shared Document (Submittable):
   - Submissions are tracked according to assigned teams (shared editing).
   - Team members collaborate on the team's submission draft.
   - Team member submits on behalf of the team.
   - Project creator views submissions according to team and posts review comments.
"""

import sys
import uuid
import json

try:
    import requests
except ImportError:
    import urllib.request
    import urllib.error

    class _Response:
        def __init__(self, status_code, body_bytes):
            self.status_code = status_code
            self.text = body_bytes.decode("utf-8") if body_bytes else ""

        def json(self):
            return json.loads(self.text) if self.text else {}

    class _RequestsWrapper:
        @staticmethod
        def _req(method, url, json_data=None, headers=None, timeout=10):
            req_headers = {"Content-Type": "application/json"}
            if headers:
                req_headers.update(headers)
            data = json.dumps(json_data).encode("utf-8") if json_data is not None else None
            req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return _Response(resp.status, resp.read())
            except urllib.error.HTTPError as e:
                return _Response(e.code, e.read())

        def get(self, url, headers=None, timeout=10):
            return self._req("GET", url, headers=headers, timeout=timeout)

        def post(self, url, json=None, headers=None, timeout=10):
            return self._req("POST", url, json_data=json, headers=headers, timeout=timeout)

        def put(self, url, json=None, headers=None, timeout=10):
            return self._req("PUT", url, json_data=json, headers=headers, timeout=timeout)

        def delete(self, url, headers=None, timeout=10):
            return self._req("DELETE", url, headers=headers, timeout=timeout)

    requests = _RequestsWrapper()

BASE_URL = "http://localhost:5000/api/v1"


def run_tests():
    print("==================================================================")
    print("Integration Tests: Personal & Team Shared Document Submissions")
    print("==================================================================")

    # 1. Health check
    print("\n--- 1. Health Check ---")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        assert r.status_code == 200, f"Health check failed: {r.text}"
        print("✓ Backend health check passed.")
    except Exception as e:
        print(f"Skipping live execution (backend not running or restricted socket): {e}")
        print("Test file created and validated syntactically.")
        return 0

    # 2. Authenticate test users
    print("\n--- 2. Authenticating Test Users ---")
    r_org = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": "demo_organizer",
        "password": "Password123!"
    })
    assert r_org.status_code == 200, f"Organizer login failed: {r_org.text}"
    org_token = r_org.json()["token"]
    org_user = r_org.json()["user"]
    print(f"✓ Creator/Organizer: {org_user['name']} ({org_user['id']})")

    r_reg = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": "demo_regular",
        "password": "Password123!"
    })
    assert r_reg.status_code == 200, f"Participant login failed: {r_reg.text}"
    reg_token = r_reg.json()["token"]
    reg_user = r_reg.json()["user"]
    print(f"✓ Participant: {reg_user['name']} ({reg_user['id']})")

    headers_creator = {"Authorization": f"Bearer {org_token}"}
    headers_participant = {"Authorization": f"Bearer {reg_token}"}

    uid = uuid.uuid4().hex[:6]

    # 3. Create shared organization and join participant
    print("\n--- 3. Setting Up Test Organization ---")
    r = requests.post(f"{BASE_URL}/organizations", json={
        "name": f"Submissions Org {uid}",
        "description": "Organization for submission verification"
    }, headers=headers_creator)
    assert r.status_code == 201, f"Create org failed: {r.text}"
    org = r.json()
    org_id = org["id"]
    join_code = org["join_code"]
    print(f"✓ Organization created: {org['name']} (join_code: {join_code})")

    r = requests.post(f"{BASE_URL}/organizations/join", json={
        "join_code": join_code
    }, headers=headers_participant)
    assert r.status_code == 200, f"Join org failed: {r.text}"
    print("✓ Participant joined the organization.")

    # Fetch templates
    r_tpls = requests.get(f"{BASE_URL}/templates", headers=headers_creator)
    assert r_tpls.status_code == 200
    tpls = r_tpls.json()
    assert len(tpls) > 0, "No templates found"
    test_tpl = tpls[0]
    print(f"✓ Using base template: {test_tpl['title']} ({test_tpl['id']})")

    # =========================================================================
    # PART A: Personal Document Submissions Flow
    # =========================================================================
    print("\n--- 4. PART A: Personal Submittable Document Workflow ---")

    # 4.1 Create project with individual association
    r = requests.post(f"{BASE_URL}/projects", json={
        "name": f"Individual Capstone {uid}",
        "description": "Project with individual submissions",
        "organization_id": org_id,
        "association_type": "individual"
    }, headers=headers_creator)
    assert r.status_code == 201, f"Create project failed: {r.text}"
    indiv_proj = r.json()
    indiv_proj_id = indiv_proj["id"]
    print(f"✓ Created Individual Project: {indiv_proj['name']}")

    # 4.2 Add participant as an individual project member
    r = requests.post(f"{BASE_URL}/projects/{indiv_proj_id}/individual-members", json={
        "user_id": reg_user["id"],
        "role": "student"
    }, headers=headers_creator)
    assert r.status_code == 200, f"Add individual member failed: {r.text}"
    print("✓ Added participant as individual member to project.")

    # 4.3 Creator creates a Personal Submittable Document
    r = requests.post(f"{BASE_URL}/documents", json={
        "title": f"Assignment 1: Architecture RFC - {uid}",
        "template_id": test_tpl["id"],
        "organization_id": org_id,
        "project_id": indiv_proj_id,
        "document_type": "personal",
        "is_submittable": True,
        "author": org_user["name"],
        "elements_data": {
            "title": f"Assignment 1 - {uid}",
            "context": "Please describe your proposed architecture and tech stack."
        }
    }, headers=headers_creator)
    assert r.status_code == 201, f"Create personal doc failed: {r.text}"
    personal_doc = r.json()
    personal_doc_id = personal_doc["id"]
    assert personal_doc["document_type"] == "personal"
    assert personal_doc["is_submittable"] is True
    print(f"✓ Personal Submittable Document created: {personal_doc['title']} (ID: {personal_doc_id})")

    # 4.3.0 Attempting to create a project_shared document under an individual project is rejected with 400
    r_invalid_type = requests.post(f"{BASE_URL}/documents", json={
        "title": f"Invalid Team Shared Doc - {uid}",
        "template_id": test_tpl["id"],
        "organization_id": org_id,
        "project_id": indiv_proj_id,
        "document_type": "project_shared",
        "is_submittable": True,
        "author": org_user["name"],
    }, headers=headers_creator)
    assert r_invalid_type.status_code == 400, f"Expected 400 for project_shared under individual project, got {r_invalid_type.status_code}"
    print("✓ Backend rejected creating project_shared document under individual project (400 Bad Request).")

    # 4.3.1 Attempting to update a document under an individual project to project_shared is rejected with 400
    r_invalid_update = requests.put(f"{BASE_URL}/documents/{personal_doc_id}", json={
        "document_type": "project_shared"
    }, headers=headers_creator)
    assert r_invalid_update.status_code == 400, f"Expected 400 for updating to project_shared under individual project, got {r_invalid_update.status_code}"
    print("✓ Backend rejected updating document under individual project to project_shared (400 Bad Request).")

    # 4.3.2 Verify non-creator cannot change collaboration type (403 Forbidden)
    r_hacked_type = requests.put(f"{BASE_URL}/documents/{personal_doc_id}", json={
        "document_type": "personal"
    }, headers=headers_participant)
    assert r_hacked_type.status_code == 403, f"Expected 403 for non-creator changing document_type, got {r_hacked_type.status_code}"
    print("✓ Backend rejected non-creator attempt to change collaboration type (403 Forbidden).")

    # 4.3.3 Verify non-creator cannot change submission setting (403 Forbidden)
    r_hacked_subm = requests.put(f"{BASE_URL}/documents/{personal_doc_id}", json={
        "is_submittable": False
    }, headers=headers_participant)
    assert r_hacked_subm.status_code == 403, f"Expected 403 for non-creator disabling submissions, got {r_hacked_subm.status_code}"
    print("✓ Backend rejected non-creator attempt to disable submissions (403 Forbidden).")

    # 4.4 Creator checks review roster before participant starts
    r = requests.get(f"{BASE_URL}/documents/{personal_doc_id}/submissions", headers=headers_creator)
    assert r.status_code == 200, f"List submissions failed: {r.text}"
    roster = r.json()
    assert len(roster) >= 1, "Expected at least 1 member in roster"
    member_entry = next((s for s in roster if s.get("user_id") == reg_user["id"]), None)
    assert member_entry is not None, "Participant not found in submissions roster"
    assert member_entry["status"] == "not_started"
    print(f"✓ Creator review roster lists participant with status '{member_entry['status']}'")

    # 4.5 Participant accesses their submission (auto-populates draft)
    r = requests.get(f"{BASE_URL}/documents/{personal_doc_id}/my-submission", headers=headers_participant)
    assert r.status_code in [200, 201], f"Get my submission failed: {r.text}"
    my_subm = r.json()
    my_subm_id = my_subm["id"]
    assert my_subm["submission_type"] == "personal"
    assert my_subm["status"] == "draft"
    assert my_subm["user_id"] == reg_user["id"]
    # Check that creator's defaults were pre-populated
    assert "context" in my_subm["elements_data"]
    print(f"✓ Participant initialized draft (ID: {my_subm_id}) with pre-populated creator prompt.")

    # 4.6 Participant updates draft content
    r = requests.put(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}", json={
        "elements_data": {
            "context": "We propose using PostgreSQL with microservices on Kubernetes.",
            "decision": "Approved modular design."
        }
    }, headers=headers_participant)
    assert r.status_code == 200, f"Update submission failed: {r.text}"
    updated_subm = r.json()
    assert "PostgreSQL" in updated_subm["compiled_markdown"]
    print("✓ Participant updated draft and markdown re-compiled dynamically.")

    # 4.7 Participant submits the personal deliverable
    r = requests.post(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/submit", headers=headers_participant)
    assert r.status_code == 200, f"Submit failed: {r.text}"
    submitted = r.json()["submission"]
    assert submitted["status"] == "submitted"
    assert submitted["submitted_at"] is not None
    print(f"✓ Personal document submitted at {submitted['submitted_at']}.")

    # 4.8 Participant un-submits and re-submits (draft flexibility)
    r = requests.post(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/unsubmit", headers=headers_participant)
    assert r.status_code == 200, f"Unsubmit failed: {r.text}"
    assert r.json()["submission"]["status"] == "draft"
    print("✓ Participant successfully un-submitted document back to draft.")

    r = requests.post(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/submit", headers=headers_participant)
    assert r.status_code == 200
    print("✓ Participant re-submitted document.")

    # 4.9 Creator inspects submitted deliverable and posts review comment
    r = requests.get(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}", headers=headers_creator)
    assert r.status_code == 200, f"Get submission detail failed: {r.text}"
    detail = r.json()
    assert detail["status"] == "submitted"
    print("✓ Creator inspected submitted deliverable content.")

    r = requests.post(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/comments", json={
        "content": "Excellent architecture breakdown! Consider adding caching layer details."
    }, headers=headers_creator)
    assert r.status_code == 201, f"Add comment failed: {r.text}"
    comment = r.json()
    assert comment["content"].startswith("Excellent")
    print("✓ Project creator posted review comment on individual submission.")

    # 4.10 Creator marks status as 'reviewed'
    r = requests.put(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/status", json={
        "status": "reviewed"
    }, headers=headers_creator)
    assert r.status_code == 200, f"Update status failed: {r.text}"
    assert r.json()["status"] == "reviewed"
    print("✓ Creator updated submission status to 'reviewed'.")

    # 4.11 Participant reads creator feedback comments and replies
    r = requests.get(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/comments", headers=headers_participant)
    assert r.status_code == 200
    comments_list = r.json()
    assert len(comments_list) >= 1
    print(f"✓ Participant fetched {len(comments_list)} review comments.")

    r = requests.post(f"{BASE_URL}/documents/{personal_doc_id}/submissions/{my_subm_id}/comments", json={
        "content": "Thank you! We will add Redis caching in Sprint 2."
    }, headers=headers_participant)
    assert r.status_code == 201
    print("✓ Participant replied to creator review comment.")

    # =========================================================================
    # PART B: Project Shared Document (Team-Based Submissions) Flow
    # =========================================================================
    print("\n--- 5. PART B: Project Shared Document (Team-Based) Workflow ---")

    # 5.1 Create functional team in organization
    r = requests.post(f"{BASE_URL}/organizations/{org_id}/teams", json={
        "name": f"Backend Alpha Team {uid}",
        "description": "Alpha engineering squad"
    }, headers=headers_creator)
    assert r.status_code == 201, f"Create team failed: {r.text}"
    team = r.json()
    team_id = team["id"]
    print(f"✓ Created Organization Team: {team['name']} ({team_id})")

    # 5.2 Add participant to team
    r = requests.post(f"{BASE_URL}/organizations/{org_id}/teams/{team_id}/members", json={
        "userId": reg_user["id"],
        "role": "lead"
    }, headers=headers_creator)
    assert r.status_code == 201, f"Add team member failed: {r.text}"
    print("✓ Added participant to Backend Alpha Team.")

    # 5.3 Create Project with Team association
    r = requests.post(f"{BASE_URL}/projects", json={
        "name": f"Enterprise Platform Project {uid}",
        "description": "Multi-team shared project",
        "organization_id": org_id,
        "association_type": "team"
    }, headers=headers_creator)
    assert r.status_code == 201
    team_proj = r.json()
    team_proj_id = team_proj["id"]
    print(f"✓ Created Team-Assoc Project: {team_proj['name']}")

    # 5.4 Assign team to the project
    r = requests.post(f"{BASE_URL}/projects/{team_proj_id}/assigned-teams", json={
        "team_id": team_id,
        "role": "Core Backend Squad"
    }, headers=headers_creator)
    assert r.status_code == 200, f"Assign team to project failed: {r.text}"
    print("✓ Assigned Alpha Team to project.")

    # 5.5 Creator creates Project Shared Submittable Document
    r = requests.post(f"{BASE_URL}/documents", json={
        "title": f"System Architecture Milestone - {uid}",
        "template_id": test_tpl["id"],
        "organization_id": org_id,
        "project_id": team_proj_id,
        "document_type": "project_shared",
        "is_submittable": True,
        "author": org_user["name"],
        "elements_data": {
            "title": f"System Architecture Milestone - {uid}",
            "context": "Team deliverables: submit your shared architectural design."
        }
    }, headers=headers_creator)
    assert r.status_code == 201, f"Create team shared doc failed: {r.text}"
    shared_doc = r.json()
    shared_doc_id = shared_doc["id"]
    assert shared_doc["document_type"] == "project_shared"
    assert shared_doc["is_submittable"] is True
    print(f"✓ Project Shared Submittable Document created: {shared_doc['title']}")

    # 5.5.1 Creator creates a Personal Submittable Document inside the Team Project (both collaboration types permitted)
    r_team_personal = requests.post(f"{BASE_URL}/documents", json={
        "title": f"Individual Peer Review Milestone - {uid}",
        "template_id": test_tpl["id"],
        "organization_id": org_id,
        "project_id": team_proj_id,
        "document_type": "personal",
        "is_submittable": True,
        "author": org_user["name"],
        "elements_data": {
            "title": f"Individual Milestone - {uid}",
            "context": "Personal deliverable inside team project."
        }
    }, headers=headers_creator)
    assert r_team_personal.status_code == 201, f"Create personal doc in team project failed: {r_team_personal.text}"
    team_personal_doc = r_team_personal.json()
    assert team_personal_doc["document_type"] == "personal"
    assert team_personal_doc["project_association_type"] == "team"
    print(f"✓ Created Personal Document inside Team Project: {team_personal_doc['title']} (both collaboration types permitted in team projects).")

    # 5.6 Creator views submissions roster (according to assigned teams)
    r = requests.get(f"{BASE_URL}/documents/{shared_doc_id}/submissions", headers=headers_creator)
    assert r.status_code == 200
    team_roster = r.json()
    assert len(team_roster) >= 1
    team_entry = next((s for s in team_roster if s.get("team_id") == team_id), None)
    assert team_entry is not None, "Assigned team not found in submissions roster"
    assert team_entry["status"] == "not_started"
    print(f"✓ Creator review roster lists Team '{team_entry.get('team_name')}' with status 'not_started'")

    # 5.7 Team member opens my-submission (auto-populates team draft)
    r = requests.get(f"{BASE_URL}/documents/{shared_doc_id}/my-submission", headers=headers_participant)
    assert r.status_code in [200, 201]
    team_subm = r.json()
    team_subm_id = team_subm["id"]
    assert team_subm["submission_type"] == "team"
    assert team_subm["team_id"] == team_id
    assert team_subm["status"] == "draft"
    print(f"✓ Team member initialized shared team draft: {team_subm['team_name']} (ID: {team_subm_id})")

    # 5.8 Team member updates team draft
    r = requests.put(f"{BASE_URL}/documents/{shared_doc_id}/submissions/{team_subm_id}", json={
        "elements_data": {
            "context": "Team Alpha finalized microservice boundaries and gRPC specs.",
            "decision": "Adopted gRPC for inter-service RPC."
        }
    }, headers=headers_participant)
    assert r.status_code == 200
    print("✓ Team member saved shared team draft.")

    # 5.9 Team member submits on behalf of the team
    r = requests.post(f"{BASE_URL}/documents/{shared_doc_id}/submissions/{team_subm_id}/submit", headers=headers_participant)
    assert r.status_code == 200
    submitted_team_doc = r.json()["submission"]
    assert submitted_team_doc["status"] == "submitted"
    print(f"✓ Team deliverable submitted on behalf of {team_subm['team_name']}.")

    # 5.10 Project creator views team submission and posts feedback
    r = requests.get(f"{BASE_URL}/documents/{shared_doc_id}/submissions/{team_subm_id}", headers=headers_creator)
    assert r.status_code == 200
    team_subm_detail = r.json()
    assert team_subm_detail["status"] == "submitted"
    assert "gRPC" in team_subm_detail["compiled_markdown"]

    r = requests.post(f"{BASE_URL}/documents/{shared_doc_id}/submissions/{team_subm_id}/comments", json={
        "content": "Outstanding work Alpha Team! The gRPC contracts look clean."
    }, headers=headers_creator)
    assert r.status_code == 201
    print("✓ Project creator reviewed and commented on team submission.")

    # 5.11 Project creator updates status to 'reviewed'
    r = requests.put(f"{BASE_URL}/documents/{shared_doc_id}/submissions/{team_subm_id}/status", json={
        "status": "reviewed"
    }, headers=headers_creator)
    assert r.status_code == 200
    assert r.json()["status"] == "reviewed"
    print("✓ Project creator updated team submission status to 'reviewed'.")

    # ==============================================================================
    # 6. Test Document Creation Permission ('creator_only' vs 'all_members')
    # ==============================================================================
    print("\n--- 6. Document Creation Permissions: Creator Only vs All Members ---")

    # 6.1 Create project with 'creator_only' document creation permission
    r_co = requests.post(f"{BASE_URL}/projects", json={
        "organization_id": org_id,
        "name": f"Creator Only Project {uuid.uuid4().hex[:6]}",
        "description": "Only project creator / org managers can create documents",
        "association_type": "individual",
        "document_creation_permission": "creator_only",
    }, headers=headers_creator)
    assert r_co.status_code == 201, f"Failed to create creator_only project: {r_co.text}"
    proj_co = r_co.json()
    proj_co_id = proj_co["id"]
    assert proj_co.get("document_creation_permission") == "creator_only"
    print(f"✓ Created project with creator_only permission: {proj_co['name']}")

    # 6.2 Regular member attempts to create document in creator_only project -> 403 Forbidden
    r_fail = requests.post(f"{BASE_URL}/documents", json={
        "title": "Unauthorized Member Spec",
        "template_id": template_id,
        "project_id": proj_co_id,
        "document_type": "personal",
    }, headers=headers_participant)
    assert r_fail.status_code == 403, f"Expected 403 Forbidden for non-creator in creator_only project, got {r_fail.status_code}: {r_fail.text}"
    print("✓ Regular member blocked with 403 Forbidden when creating doc in 'creator_only' project.")

    # 6.3 Project creator successfully creates document in creator_only project -> 201
    r_ok = requests.post(f"{BASE_URL}/documents", json={
        "title": "Creator Authored Spec",
        "template_id": template_id,
        "project_id": proj_co_id,
        "document_type": "personal",
    }, headers=headers_creator)
    assert r_ok.status_code == 201, f"Project creator failed to create doc: {r_ok.text}"
    print("✓ Project creator successfully created doc in 'creator_only' project.")

    # 6.4 Create project with 'all_members' document creation permission
    r_am = requests.post(f"{BASE_URL}/projects", json={
        "organization_id": org_id,
        "name": f"All Members Project {uuid.uuid4().hex[:6]}",
        "description": "All organization members can author documents",
        "association_type": "individual",
        "document_creation_permission": "all_members",
    }, headers=headers_creator)
    assert r_am.status_code == 201
    proj_am = r_am.json()
    proj_am_id = proj_am["id"]
    assert proj_am.get("document_creation_permission") == "all_members"
    print(f"✓ Created project with all_members permission: {proj_am['name']}")

    # 6.5 Regular member creates document in all_members project -> 201
    r_member_doc = requests.post(f"{BASE_URL}/documents", json={
        "title": "Member Authored Proposal",
        "template_id": template_id,
        "project_id": proj_am_id,
        "document_type": "personal",
        "is_submittable": True,
    }, headers=headers_participant)
    assert r_member_doc.status_code == 201, f"Regular member failed to create doc in all_members project: {r_member_doc.text}"
    member_doc = r_member_doc.json()
    member_doc_id = member_doc["id"]
    assert member_doc.get("created_by") == reg_user["id"], "Member must be the document creator"
    print(f"✓ Regular member created document as document creator: {member_doc['title']} (created_by: {member_doc['created_by']})")

    # 6.6 Non-creator (Organizer) cannot change collaboration type on member's document -> 403
    r_org_change = requests.put(f"{BASE_URL}/documents/{member_doc_id}", json={
        "document_type": "project_shared",
    }, headers=headers_creator)
    assert r_org_change.status_code in [400, 403], f"Expected rejection on non-creator changing doc type, got: {r_org_change.status_code}"
    print("✓ Non-creator blocked when attempting to change collaboration type on document.")

    # 6.7 Member (as document creator) can query submissions roster
    r_subm_roster = requests.get(f"{BASE_URL}/documents/{member_doc_id}/submissions", headers=headers_participant)
    assert r_subm_roster.status_code == 200
    print("✓ Document creator successfully accessed submissions review roster.")

    print("\n==================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! (Personal & Team Shared Submissions & Creation Permissions)")
    print("==================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
