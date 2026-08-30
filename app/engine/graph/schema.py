from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass, field


class NodeType(str, Enum):
    PRODUCT = "Product"
    LICENSE = "License"
    MANUFACTURER = "Manufacturer"
    INDIAN_STANDARD = "IndianStandard"
    TEST_LAB = "TestLab"


class EdgeType(str, Enum):
    COVERS = "COVERS"
    ISSUED_TO = "ISSUED_TO"
    CONFORMS_TO = "CONFORMS_TO"
    TESTED_BY = "TESTED_BY"


class LicenseStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"


class LabAccreditation(str, Enum):
    VALID = "VALID"
    INVALID = "INVALID"


@dataclass
class NodeData:
    id: str
    type: NodeType
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EdgeData:
    source: str
    target: str
    type: EdgeType
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VerificationPath:
    node_id: str
    node_type: str
    status: str
    details: str
