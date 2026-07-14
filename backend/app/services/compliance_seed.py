"""Seed compliance frameworks and controls (idempotent)."""
from sqlalchemy.orm import Session
from app.models.compliance_framework import ComplianceFramework
from app.models.compliance_control import ComplianceControl

FRAMEWORKS = [
    {
        "name": "ISO 27001",
        "version": "2022",
        "description": "International standard for information security management systems",
        "category": "Information Security",
        "color": "#3B82F6",
        "controls": [
            ("A.5.1",  "Information security policies",            "Policies",        "High",     True,  "audit_logs_enabled"),
            ("A.5.2",  "Information security roles and responsibilities", "Policies", "High",     False, None),
            ("A.6.1",  "Screening",                               "People",          "Medium",   False, None),
            ("A.6.3",  "Information security awareness & training","People",          "Medium",   False, None),
            ("A.8.2",  "Privileged access rights",                "Access Control",  "Critical", True,  "mfa_enforced"),
            ("A.8.5",  "Secure authentication",                   "Access Control",  "Critical", True,  "mfa_enforced"),
            ("A.8.7",  "Protection against malware",              "Operations",      "Critical", True,  "yara_active"),
            ("A.8.15", "Logging",                                 "Operations",      "High",     True,  "audit_logs_enabled"),
            ("A.8.16", "Monitoring activities",                   "Operations",      "High",     True,  "agents_active"),
            ("A.8.20", "Network security controls",               "Network",         "High",     True,  "agents_active"),
            ("A.8.22", "Segregation of networks",                 "Network",         "Medium",   False, None),
            ("A.8.24", "Use of cryptography",                     "Cryptography",    "High",     False, None),
            ("A.8.28", "Secure coding",                           "Development",     "High",     False, None),
            ("A.5.23", "Information security for cloud services", "Cloud",           "High",     True,  "agents_active"),
        ],
    },
    {
        "name": "SOC 2",
        "version": "Type II",
        "description": "Service Organization Controls for security, availability, and confidentiality",
        "category": "Trust Services",
        "color": "#8B5CF6",
        "controls": [
            ("CC1.1",  "COSO principle — demonstrates commitment to integrity",  "Control Environment", "High",     False, None),
            ("CC2.1",  "Board oversees internal control",                        "Control Environment", "Medium",   False, None),
            ("CC3.2",  "Specification of suitable control objectives",           "Risk Assessment",     "High",     False, None),
            ("CC4.1",  "Selects and develops monitoring activities",             "Monitoring",          "High",     True,  "audit_logs_enabled"),
            ("CC5.3",  "Deploys control activities through policies",            "Control Activities",  "High",     False, None),
            ("CC6.1",  "Logical access security",                                "Logical Access",      "Critical", True,  "mfa_enforced"),
            ("CC6.3",  "Role-based access control",                              "Logical Access",      "Critical", False, None),
            ("CC6.6",  "Logical access from outside boundaries",                 "Logical Access",      "High",     True,  "agents_active"),
            ("CC6.7",  "Transmission of data",                                   "Logical Access",      "High",     False, None),
            ("CC6.8",  "Prevent or detect unauthorized or malicious software",   "Logical Access",      "Critical", True,  "yara_active"),
            ("CC7.1",  "Detects and monitors for security threats",              "System Operations",   "Critical", True,  "agents_active"),
            ("CC7.2",  "Monitors system components for anomalies",               "System Operations",   "High",     True,  "alerts_configured"),
            ("CC7.3",  "Evaluates and communicates security events",             "System Operations",   "High",     True,  "alerts_configured"),
            ("CC8.1",  "Change management process",                              "Change Management",   "Medium",   False, None),
            ("CC9.2",  "Vendor risk management",                                 "Risk Mitigation",     "Medium",   False, None),
        ],
    },
    {
        "name": "PCI DSS",
        "version": "v4.0",
        "description": "Payment Card Industry Data Security Standard",
        "category": "Payment Security",
        "color": "#F59E0B",
        "controls": [
            ("Req-1",  "Install and maintain network security controls",         "Network",             "Critical", True,  "agents_active"),
            ("Req-2",  "Apply secure configurations to all system components",   "Configuration",       "High",     False, None),
            ("Req-3",  "Protect stored account data",                            "Data Protection",     "Critical", False, None),
            ("Req-4",  "Protect cardholder data over open networks",             "Data Protection",     "Critical", False, None),
            ("Req-5",  "Protect all systems from malicious software",            "Malware Protection",  "Critical", True,  "yara_active"),
            ("Req-6",  "Develop and maintain secure systems and software",       "Development",         "High",     False, None),
            ("Req-7",  "Restrict access to system components",                   "Access Control",      "Critical", False, None),
            ("Req-8",  "Identify users and authenticate access",                 "Authentication",      "Critical", True,  "mfa_enforced"),
            ("Req-9",  "Restrict physical access to cardholder data",            "Physical Security",   "High",     False, None),
            ("Req-10", "Log and monitor all access to system components",        "Logging",             "Critical", True,  "audit_logs_enabled"),
            ("Req-11", "Test security of systems and networks regularly",        "Testing",             "High",     True,  "agents_active"),
            ("Req-12", "Support information security with policies and programs","Policy",              "Medium",   False, None),
        ],
    },
    {
        "name": "GDPR",
        "version": "2018",
        "description": "EU General Data Protection Regulation",
        "category": "Privacy",
        "color": "#10B981",
        "controls": [
            ("Art-5",  "Principles of processing personal data",                 "Principles",          "Critical", False, None),
            ("Art-6",  "Lawful basis for processing",                            "Lawfulness",          "Critical", False, None),
            ("Art-12", "Transparent information and communication",              "Rights",              "High",     False, None),
            ("Art-13", "Privacy notice at data collection",                      "Rights",              "High",     False, None),
            ("Art-17", "Right to erasure",                                       "Rights",              "High",     False, None),
            ("Art-20", "Data portability",                                       "Rights",              "Medium",   False, None),
            ("Art-25", "Data protection by design and by default",               "Technical Controls",  "High",     False, None),
            ("Art-30", "Records of processing activities",                       "Documentation",       "High",     True,  "audit_logs_enabled"),
            ("Art-32", "Security of processing",                                 "Technical Controls",  "Critical", True,  "agents_active"),
            ("Art-33", "Notification of data breach to supervisory authority",   "Incident Response",   "Critical", True,  "alerts_configured"),
            ("Art-34", "Communication of data breach to data subject",           "Incident Response",   "High",     False, None),
            ("Art-35", "Data protection impact assessment",                      "Risk",                "High",     False, None),
            ("Art-37", "Designation of data protection officer",                 "Governance",          "Medium",   False, None),
        ],
    },
    {
        "name": "DPDP Act",
        "version": "2023",
        "description": "India's Digital Personal Data Protection Act",
        "category": "Privacy",
        "color": "#FF6B35",
        "controls": [
            ("Sec-4",  "Lawful processing of personal data",                     "Lawfulness",          "Critical", False, None),
            ("Sec-5",  "Notice for processing personal data",                    "Transparency",        "High",     False, None),
            ("Sec-6",  "Consent management",                                     "Consent",             "Critical", False, None),
            ("Sec-8",  "General obligations of data fiduciary",                  "Obligations",         "High",     True,  "audit_logs_enabled"),
            ("Sec-9",  "Processing of personal data of children",                "Special Categories",  "Critical", False, None),
            ("Sec-11", "Right of the Data Principal to access information",      "Rights",              "High",     False, None),
            ("Sec-12", "Right to correction and erasure",                        "Rights",              "High",     False, None),
            ("Sec-14", "Right to nominate",                                      "Rights",              "Low",      False, None),
            ("Sec-16", "Transfer of personal data outside India",                "Cross-Border",        "High",     False, None),
            ("Sec-22", "Security safeguards",                                    "Technical Controls",  "Critical", True,  "agents_active"),
            ("Sec-23", "Intimation of personal data breach",                     "Incident Response",   "Critical", True,  "alerts_configured"),
            ("Sec-24", "Data Retention",                                         "Retention",           "High",     False, None),
        ],
    },
    {
        "name": "HIPAA",
        "version": "2013",
        "description": "Health Insurance Portability and Accountability Act",
        "category": "Healthcare",
        "color": "#EF4444",
        "controls": [
            ("164.308-a1", "Security Officer designation",                       "Administrative",      "High",     False, None),
            ("164.308-a3", "Workforce training and access",                      "Administrative",      "High",     False, None),
            ("164.308-a4", "Information access management",                      "Access Control",      "Critical", True,  "mfa_enforced"),
            ("164.308-a5", "Security awareness and training",                    "Administrative",      "Medium",   False, None),
            ("164.308-a6", "Security incident procedures",                       "Incident Response",   "Critical", True,  "alerts_configured"),
            ("164.308-a7", "Contingency plan",                                   "Continuity",          "High",     False, None),
            ("164.308-a8", "Evaluation",                                         "Audit",               "High",     True,  "audit_logs_enabled"),
            ("164.310-a1", "Facility access controls",                           "Physical",            "High",     False, None),
            ("164.312-a1", "Unique user identification",                         "Access Control",      "Critical", False, None),
            ("164.312-a2", "Emergency access procedure",                         "Access Control",      "High",     False, None),
            ("164.312-b",  "Audit controls",                                     "Audit",               "Critical", True,  "audit_logs_enabled"),
            ("164.312-c1", "Integrity controls",                                 "Integrity",           "High",     True,  "agents_active"),
            ("164.312-d",  "Person or entity authentication",                    "Authentication",      "Critical", True,  "mfa_enforced"),
            ("164.312-e1", "Transmission security",                              "Technical",           "High",     False, None),
        ],
    },
]


def seed_compliance(db: Session) -> None:
    for fw_data in FRAMEWORKS:
        controls = fw_data["controls"]  # read-only — do NOT pop/mutate module-level list
        fw_attrs = {k: v for k, v in fw_data.items() if k != "controls"}

        fw = db.query(ComplianceFramework).filter_by(name=fw_attrs["name"]).first()
        if not fw:
            fw = ComplianceFramework(**fw_attrs)
            db.add(fw)
            db.flush()

        for ctrl_ref, title, category, priority, auto_check, check_type in controls:
            existing = (
                db.query(ComplianceControl)
                .filter_by(framework_id=fw.id, control_ref=ctrl_ref)
                .first()
            )
            if not existing:
                db.add(ComplianceControl(
                    framework_id=fw.id,
                    control_ref=ctrl_ref,
                    title=title,
                    category=category,
                    priority=priority,
                    xdr_auto_check=auto_check,
                    check_type=check_type,
                ))

    db.commit()
