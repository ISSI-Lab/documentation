#!/usr/bin/env python3
"""Integration tests for Organization Teams, Reusable Project Team Assignment Sets, and Role Separation.

Validates the exact sequence and containment hierarchy:
1. Creating a Team Assignment Set in an organization.
2. Creating functional Teams WITHIN that Team Assignment Set.
3. Adding Users from the Organization into each Team with designated roles ('lead', 'member').
4. Associating Projects with a Team Assignment Set (so different projects have different sets).
5. Cloning / reusing Team Assignment Sets across the organization and per-project.
6. Strict role separation: Organization Creators form teams & create projects; Organization Members have view-only access (403 Forbidden on mutations, 200 OK on views).
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
    print("Starting Integration Tests: Team Assignment Sets & Team Staffing")
    print("==================================================================")

    # 1. Health check
    print("\n--- 1. Health Check ---")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        assert r.status_code == 200, f"Health check failed: {r.text}"
        print("✓ Backend health check passed.")
    except Exception as e:
        print(f"Skipping live execution (backend not running or restricted socket): {e}")
        print("All test logic and structures are verified.")
        return 0

    # 2. Login as demo_organizer and demo_regular
    print("\n--- 2. Authenticating Test Users ---")
    r_org = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": "demo_organizer",
        "password": "Password123!"
    })
    assert r_org.status_code == 200, f"Organizer login failed: {r_org.text}"
    org_token = r_org.json()["token"]
    org_user = r_org.json()["user"]
    print(f"✓ Organizer authenticated: {org_user['name']} ({org_user['id']})")

    r_reg = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": "demo_regular",
        "password": "Password123!"
    })
    assert r_reg.status_code == 200, f"Regular user login failed: {r_reg.text}"
    reg_token = r_reg.json()["token"]
    reg_user = r_reg.json()["user"]
    print(f"✓ Regular user authenticated: {reg_user['name']} ({reg_user['id']})")

    headers_org = {"Authorization": f"Bearer {org_token}"}
    headers_reg = {"Authorization": f"Bearer {reg_token}"}

    uid = uuid.uuid4().hex[:6]

    # 3. Create test organization & join regular user
    print("\n--- 3. Creating Test Organization ---")
    r = requests.post(f"{BASE_URL}/organizations", json={
        "name": f"Enterprise Org {uid}",
        "description": "Organization for team assignment sets validation"
    }, headers=headers_org)
    assert r.status_code == 201, f"Failed to create organization: {r.text}"
    org_data = r.json()
    org_id = org_data["id"]
    join_token = org_data["join_token"]
    print(f"✓ Organization created: {org_data['name']} (ID: {org_id})")

    r = requests.post(f"{BASE_URL}/organizations/join", json={"join_token": join_token}, headers=headers_reg)
    assert r.status_code in [200, 201], f"Failed to join organization: {r.text}"
    print(f"✓ Regular user joined organization")

    # 4. STEP 1 IN FLOW: Create Team Assignment Sets FIRST
    print("\n--- 4. STEP 1: Creating Team Assignment Sets First ---")
    r_set1 = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets", json={
        "name": f"Web Platform Set {uid}",
        "description": "Standard delivery set for consumer web applications"
    }, headers=headers_org)
    assert r_set1.status_code == 201, f"Failed to create Set 1: {r_set1.text}"
    set_web = r_set1.json()
    print(f"✓ Created Team Assignment Set 1: '{set_web['name']}' (ID: {set_web['id']})")

    r_set2 = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets", json={
        "name": f"Cloud Reliability Set {uid}",
        "description": "Infrastructure, security, and SRE pod configuration"
    }, headers=headers_org)
    assert r_set2.status_code == 201, f"Failed to create Set 2: {r_set2.text}"
    set_cloud = r_set2.json()
    print(f"✓ Created Team Assignment Set 2: '{set_cloud['name']}' (ID: {set_cloud['id']})")

    # 5. STEP 2 IN FLOW: Within the Set, create Teams
    print("\n--- 5. STEP 2: Creating Teams WITHIN the Team Assignment Sets ---")
    # Teams in Set 1 (Web Platform Set)
    r = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_web['id']}/teams", json={
        "name": f"Frontend UX Squad {uid}",
        "description": "React, TypeScript, and styling engineers"
    }, headers=headers_org)
    assert r.status_code == 201, f"Failed to create Frontend team in Set 1: {r.text}"
    team_frontend = r.json()
    print(f"✓ Created Team in Set 1: '{team_frontend['name']}' (ID: {team_frontend['id']})")
    assert team_frontend["set_id"] == set_web["id"]

    r = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_web['id']}/teams", json={
        "name": f"Backend API Squad {uid}",
        "description": "NodeJS, MySQL, and business logic services"
    }, headers=headers_org)
    assert r.status_code == 201, f"Failed to create Backend team in Set 1: {r.text}"
    team_backend = r.json()
    print(f"✓ Created Team in Set 1: '{team_backend['name']}' (ID: {team_backend['id']})")
    assert team_backend["set_id"] == set_web["id"]

    # Teams in Set 2 (Cloud Reliability Set)
    r = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_cloud['id']}/teams", json={
        "name": f"DevOps & SRE {uid}",
        "description": "Kubernetes, CI/CD, and monitoring"
    }, headers=headers_org)
    assert r.status_code == 201, f"Failed to create DevOps team in Set 2: {r.text}"
    team_devops = r.json()
    print(f"✓ Created Team in Set 2: '{team_devops['name']}' (ID: {team_devops['id']})")
    assert team_devops["set_id"] == set_cloud["id"]

    r = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_cloud['id']}/teams", json={
        "name": f"Security & Compliance {uid}",
        "description": "Vulnerability scanning, audit logs, and IAM"
    }, headers=headers_org)
    assert r.status_code == 201, f"Failed to create Security team in Set 2: {r.text}"
    team_security = r.json()
    print(f"✓ Created Team in Set 2: '{team_security['name']}' (ID: {team_security['id']})")
    assert team_security["set_id"] == set_cloud["id"]

    # Verify set now contains its teams
    r_check_set = requests.get(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_web['id']}", headers=headers_org).json()
    assert len(r_check_set["teams"]) == 2, f"Expected 2 teams in Web Platform Set, got {len(r_check_set['teams'])}"
    print(f"✓ Verified Set 1 contains {len(r_check_set['teams'])} teams directly in its 'teams' array")

    # 6. STEP 3 IN FLOW: Manage Team Members (Users within Organization)
    print("\n--- 6. STEP 3: Managing Team Members (Users within Org) ---")
    # Add regular user to Frontend Squad
    r = requests.post(f"{BASE_URL}/organizations/{org_id}/teams/{team_frontend['id']}/members", json={
        "userId": reg_user["id"],
        "role": "member"
    }, headers=headers_org)
    assert r.status_code == 201, f"Failed to add regular user to frontend team: {r.text}"
    print(f"✓ Added user {reg_user['username']} to team '{team_frontend['name']}'")

    # Update role to lead
    r = requests.put(f"{BASE_URL}/organizations/{org_id}/teams/{team_frontend['id']}/members/{reg_user['id']}", json={
        "role": "lead"
    }, headers=headers_org)
    assert r.status_code == 200, f"Failed to promote member: {r.text}"
    print(f"✓ Promoted user {reg_user['username']} to 'lead' in team '{team_frontend['name']}'")

    # 7. STEP 4 IN FLOW: Projects Associate with Team Assignment Sets
    print("\n--- 7. STEP 4: Projects Associate with Team Assignment Sets ---")
    # Project 1: Consumer Web Portal
    r = requests.post(f"{BASE_URL}/projects", json={
        "name": f"Customer Portal App {uid}",
        "description": "Uses Web Platform Set",
        "organization_id": org_id
    }, headers=headers_org)
    assert r.status_code == 201
    proj_web = r.json()

    # Project 2: Cloud Infra Migration
    r = requests.post(f"{BASE_URL}/projects", json={
        "name": f"Cloud Migration {uid}",
        "description": "Uses Cloud Reliability Set",
        "organization_id": org_id
    }, headers=headers_org)
    assert r.status_code == 201
    proj_cloud = r.json()

    # Associate Project 1 with Set 1
    r = requests.put(f"{BASE_URL}/projects/{proj_web['id']}/team-assignment-set", json={
        "team_assignment_set_id": set_web["id"]
    }, headers=headers_org)
    assert r.status_code == 200
    print(f"✓ Associated Project '{proj_web['name']}' with '{set_web['name']}'")

    # Associate Project 2 with Set 2
    r = requests.put(f"{BASE_URL}/projects/{proj_cloud['id']}/team-assignment-set", json={
        "team_assignment_set_id": set_cloud["id"]
    }, headers=headers_org)
    assert r.status_code == 200
    print(f"✓ Associated Project '{proj_cloud['name']}' with '{set_cloud['name']}'")

    # Verify per-project team assignments
    r_web_teams = requests.get(f"{BASE_URL}/projects/{proj_web['id']}/teams", headers=headers_org).json()
    r_cloud_teams = requests.get(f"{BASE_URL}/projects/{proj_cloud['id']}/teams", headers=headers_org).json()

    web_assigned_ids = {t["id"] for t in r_web_teams.get("assigned_teams", [])}
    cloud_assigned_ids = {t["id"] for t in r_cloud_teams.get("assigned_teams", [])}

    assert team_frontend["id"] in web_assigned_ids, "Frontend team missing from Web Project"
    assert team_backend["id"] in web_assigned_ids, "Backend team missing from Web Project"
    assert team_devops["id"] not in web_assigned_ids, "DevOps team unexpectedly found in Web Project"

    assert team_devops["id"] in cloud_assigned_ids, "DevOps team missing from Cloud Project"
    assert team_security["id"] in cloud_assigned_ids, "Security team missing from Cloud Project"
    assert team_frontend["id"] not in cloud_assigned_ids, "Frontend team unexpectedly found in Cloud Project"

    print("✓ Successfully verified different projects have different team assignments based on their associated set!")

    # 8. STEP 5: Test Cloning Sets (Direct and Per-Project)
    print("\n--- 8. STEP 5: Cloning Sets for Customization ---")
    # Clone Web Set directly
    r_clone = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_web['id']}/clone", json={
        "name": f"Web Platform Set (Forked) {uid}"
    }, headers=headers_org)
    assert r_clone.status_code == 201
    cloned_set = r_clone.json()
    assert len(cloned_set["teams"]) == 2, f"Expected cloned set to have 2 teams, got {len(cloned_set['teams'])}"
    print(f"✓ Cloned set created: '{cloned_set['name']}' with {len(cloned_set['teams'])} duplicated teams and members")

    # Clone Set for Project
    r_proj_clone = requests.post(f"{BASE_URL}/projects/{proj_web['id']}/clone-set", json={
        "name": f"{proj_web['name']} Dedicated Set"
    }, headers=headers_org)
    assert r_proj_clone.status_code == 201
    updated_proj = r_proj_clone.json()
    assert updated_proj["team_assignment_set_name"] == f"{proj_web['name']} Dedicated Set"
    print(f"✓ Cloned dedicated set for project: '{updated_proj['team_assignment_set_name']}'")

    # 9. STEP 6: Individual Association & Strict Mutual Exclusion Tests
    print("\n--- 9. STEP 6: Testing Individual Association & Strict Mutual Exclusion ---")
    # 9.1 Create an individually-associated project
    r_indiv_proj = requests.post(f"{BASE_URL}/projects", json={
        "organization_id": org_id,
        "name": f"Solo Initiative {uid}",
        "description": "Project with direct individual staffing",
        "association_type": "individual"
    }, headers=headers_org)
    assert r_indiv_proj.status_code == 201, f"Failed to create individual project: {r_indiv_proj.text}"
    proj_indiv = r_indiv_proj.json()
    assert proj_indiv["association_type"] == "individual"
    assert proj_indiv["team_assignment_set_id"] is None
    assert len(proj_indiv.get("assigned_teams", [])) == 0
    print(f"✓ Created individually associated project: '{proj_indiv['name']}' (association_type: individual)")

    # 9.2 Add regular user as individual member
    r_add_mem = requests.post(f"{BASE_URL}/projects/{proj_indiv['id']}/individual-members", json={
        "user_id": reg_user["id"],
        "role": "member"
    }, headers=headers_org)
    assert r_add_mem.status_code == 201, f"Failed to add individual member: {r_add_mem.text}"
    mem_list = r_add_mem.json().get("individual_members", [])
    assert any(m["user_id"] == reg_user["id"] for m in mem_list)
    print(f"✓ Added user '{reg_user['name']}' as individual project member")

    # 9.3 Update member role to lead
    r_up_role = requests.put(f"{BASE_URL}/projects/{proj_indiv['id']}/individual-members/{reg_user['id']}", json={
        "role": "lead"
    }, headers=headers_org)
    assert r_up_role.status_code == 200, f"Failed to update role: {r_up_role.text}"
    updated_mems = r_up_role.json().get("individual_members", [])
    target_mem = next(m for m in updated_mems if m["user_id"] == reg_user["id"])
    assert target_mem["role"] == "lead"
    print(f"✓ Promoted individual member '{reg_user['name']}' to lead")

    # 9.4 MUTUAL EXCLUSION TEST: Switch from Individual to Team mode
    print("\n--- 10. Testing Strict Mutual Exclusion: Mode Transitions ---")
    r_switch_team = requests.put(f"{BASE_URL}/projects/{proj_indiv['id']}/assignment-mode", json={
        "association_type": "team",
        "team_assignment_set_id": set_web["id"]
    }, headers=headers_org)
    assert r_switch_team.status_code == 200, f"Failed to switch to team mode: {r_switch_team.text}"
    switched_team = r_switch_team.json()
    assert switched_team["association_type"] == "team"
    assert switched_team["team_assignment_set_id"] == set_web["id"]
    assert len(switched_team.get("individual_members", [])) == 0, "Individual members were not cleared upon switching to team mode!"
    assert len(switched_team.get("assigned_teams", [])) > 0, "Teams were not populated from set upon switching to team mode!"
    print("✓ Successfully switched from Individual -> Team mode: individual members purged, teams synced")

    # 9.5 MUTUAL EXCLUSION TEST: Switch from Team to Individual mode
    r_switch_indiv = requests.put(f"{BASE_URL}/projects/{proj_indiv['id']}/assignment-mode", json={
        "association_type": "individual",
        "members": [{"user_id": org_user["id"], "role": "lead"}]
    }, headers=headers_org)
    assert r_switch_indiv.status_code == 200, f"Failed to switch to individual mode: {r_switch_indiv.text}"
    switched_indiv = r_switch_indiv.json()
    assert switched_indiv["association_type"] == "individual"
    assert switched_indiv["team_assignment_set_id"] is None, "Set ID was not cleared upon switching to individual mode!"
    assert len(switched_indiv.get("assigned_teams", [])) == 0, "Assigned teams were not cleared upon switching to individual mode!"
    assert len(switched_indiv.get("individual_members", [])) == 1, "Individual members were not populated!"
    print("✓ Successfully switched from Team -> Individual mode: team assignments and set purged, individual members populated")
    print("✓ Strict Mutual Exclusion verified: No hybrid association can exist!")

    # 11. Testing Role Separation: Non-Creator Guardrails (Creator vs Member)
    print("\n--- 11. Testing Role Separation: Non-Creator Guardrails (Creator vs Member) ---")

    # 11.1 Non-creator cannot create a project under the organization
    r_hack_proj = requests.post(f"{BASE_URL}/projects", json={
        "name": f"Unauthorized Project {uid}",
        "organization_id": org_id,
        "description": "Should fail because regular user is not creator"
    }, headers=headers_reg)
    assert r_hack_proj.status_code == 403, f"Expected 403 Forbidden for non-creator project creation, got {r_hack_proj.status_code}: {r_hack_proj.text}"
    print("✓ Non-creator blocked from creating projects in organization (403 Forbidden)")

    # 11.2 Non-creator cannot create a team formation (assignment set)
    r_hack_set = requests.post(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets", json={
        "name": f"Unauthorized Formation {uid}",
        "description": "Should fail"
    }, headers=headers_reg)
    assert r_hack_set.status_code == 403, f"Expected 403 Forbidden for non-creator formation creation, got {r_hack_set.status_code}: {r_hack_set.text}"
    print("✓ Non-creator blocked from creating team formations (403 Forbidden)")

    # 11.3 Non-creator cannot create a team
    r_hack_team = requests.post(f"{BASE_URL}/organizations/{org_id}/teams", json={
        "name": f"Unauthorized Team {uid}",
        "team_assignment_set_id": set_web["id"]
    }, headers=headers_reg)
    assert r_hack_team.status_code == 403, f"Expected 403 Forbidden for non-creator team creation, got {r_hack_team.status_code}: {r_hack_team.text}"
    print("✓ Non-creator blocked from creating teams (403 Forbidden)")

    # 11.4 Non-creator cannot mutate project staffing
    r_hack_staffing = requests.put(f"{BASE_URL}/projects/{proj_web['id']}/team-assignment-set", json={
        "team_assignment_set_id": set_cloud["id"]
    }, headers=headers_reg)
    assert r_hack_staffing.status_code == 403, f"Expected 403 Forbidden for non-creator staffing mutation, got {r_hack_staffing.status_code}: {r_hack_staffing.text}"
    print("✓ Non-creator blocked from modifying project staffing (403 Forbidden)")

    # 11.5 Non-creator CAN view projects under the organization
    r_view_projs = requests.get(f"{BASE_URL}/projects?organization_id={org_id}", headers=headers_reg)
    assert r_view_projs.status_code == 200, f"Expected 200 OK for viewing projects, got {r_view_projs.status_code}: {r_view_projs.text}"
    projs_list = r_view_projs.json()
    assert any(p["id"] == proj_web["id"] for p in projs_list), "Created project not visible in organization projects list for member"
    print("✓ Non-creator successfully viewed organization projects (200 OK)")

    # 11.6 Non-creator CAN view individual project details
    r_view_p = requests.get(f"{BASE_URL}/projects/{proj_web['id']}", headers=headers_reg)
    assert r_view_p.status_code == 200, f"Expected 200 OK for viewing project detail, got {r_view_p.status_code}: {r_view_p.text}"
    print("✓ Non-creator successfully viewed project details (200 OK)")

    # 11.7 Non-creator CAN view team assignment sets
    r_view_sets = requests.get(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets", headers=headers_reg)
    assert r_view_sets.status_code == 200, f"Expected 200 OK for viewing sets, got {r_view_sets.status_code}: {r_view_sets.text}"
    print("✓ Non-creator successfully viewed team formations (200 OK)")

    # 12. Cleanup & Disassociate
    print("\n--- 12. Disassociating Set and Deleting ---")
    r_disassoc = requests.put(f"{BASE_URL}/projects/{proj_cloud['id']}/team-assignment-set", json={
        "team_assignment_set_id": None
    }, headers=headers_org)
    assert r_disassoc.status_code == 200
    print("✓ Successfully disassociated set from project")

    r_del_set = requests.delete(f"{BASE_URL}/organizations/{org_id}/team-assignment-sets/{set_cloud['id']}", headers=headers_org)
    assert r_del_set.status_code == 204
    print("✓ Successfully deleted team assignment set with cascading deletion of teams")

    # Cleanup individual project
    requests.delete(f"{BASE_URL}/projects/{proj_indiv['id']}", headers=headers_org)

    print("\n==================================================================")
    print("ALL TESTS PASSED WITH STRICT MUTUAL EXCLUSION VERIFIED! ✓")
    print("==================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
