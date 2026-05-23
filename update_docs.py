import re
from pathlib import Path

repo_root = Path('/home/timgeldard/github/connectio-rad-v2')

def update_spc_readme():
    path = repo_root / 'domain-integrations/spc/README.md'
    if not path.exists(): return
    text = path.read_text()
    text = text.replace("no native runtime route is wired", "the native GET /api/spc/subgroups is wired but browser UAT is pending")
    text = text.replace("native direct route not implemented", "native GET /api/spc/subgroups exists")
    path.write_text(text)

def update_spc_checklist():
    path = repo_root / 'domain-integrations/spc/docs/spc-native-migration-readiness-checklist.md'
    if not path.exists(): return
    text = path.read_text()
    text = text.replace("no native runtime route is wired", "the native GET /api/spc/subgroups is wired but browser UAT is pending")
    path.write_text(text)

def update_spc_plan():
    path = repo_root / 'domain-integrations/spc/docs/spc-native-route-prerequisite-plan.md'
    if not path.exists(): return
    text = path.read_text()
    text = text.replace("no native runtime route is wired", "the native GET /api/spc/subgroups is wired but browser UAT is pending")
    path.write_text(text)

def update_trace_readme():
    path = repo_root / 'domain-integrations/traceability/README.md'
    if not path.exists(): return
    text = path.read_text()
    text = re.sub(r'Trace App routes.*are pending', 'Trace App routes (recall-readiness, supplier-batches, batch-quality-passport, mass-balance-ledger, investigation-timeline, holds-ledger) exist as code-fixed but browser-UAT-pending read-only evidence routes', text)
    path.write_text(text)

update_spc_readme()
update_spc_checklist()
update_spc_plan()
update_trace_readme()
print("Documentation updated")
