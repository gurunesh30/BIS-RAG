import json
import os
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import deque

import networkx as nx

from .schema import (
    NodeType, EdgeType, LicenseStatus, LabAccreditation,
    NodeData, EdgeData, VerificationPath
)


class KnowledgeGraphEngine:
    def __init__(self, backup_path: str = "./graph_backup.json"):
        self.graph = nx.DiGraph()
        self.backup_path = backup_path
        self._load_backup()
        self._seed_demo_graph()

    def _seed_demo_graph(self) -> None:
        """Populate a realistic BIS supply-chain graph if the graph is empty."""
        if self.graph.number_of_nodes() > 0:
            return

        # ── Nodes ──────────────────────────────────────────────────────
        nodes = [
            NodeData(id="CM/L-1234567", type=NodeType.LICENSE, attributes={
                "status": LicenseStatus.ACTIVE,
                "expiry_date": "2028-06-30",
                "name": "CM/L-1234567"
            }),
            NodeData(id="CM/L-9999999", type=NodeType.LICENSE, attributes={
                "status": LicenseStatus.EXPIRED,
                "expiry_date": "2024-01-15",
                "name": "CM/L-9999999 (Expired)"
            }),
            NodeData(id="MFG-Apex", type=NodeType.MANUFACTURER, attributes={
                "name": "Apex Electronics Pvt Ltd",
                "factory_registration_active": True,
                "factory_address": "Plot 42, Electronics Complex, Gurugram"
            }),
            NodeData(id="MFG-SunPower", type=NodeType.MANUFACTURER, attributes={
                "name": "SunPower Manufacturing India Ltd",
                "factory_registration_active": True,
                "factory_address": "Industrial Zone Phase III, Ahmedabad"
            }),
            NodeData(id="MFG-UltraTech", type=NodeType.MANUFACTURER, attributes={
                "name": "UltraTech Cement Works Unit 4",
                "factory_registration_active": True,
                "factory_address": "Cement Nagar, Chandrapur, Maharashtra"
            }),
            NodeData(id="IS 13252", type=NodeType.INDIAN_STANDARD, attributes={
                "name": "IS 13252 – IT Equipment Safety",
                "active": True
            }),
            NodeData(id="IS 14286", type=NodeType.INDIAN_STANDARD, attributes={
                "name": "IS 14286 – Solar PV Modules",
                "active": True
            }),
            NodeData(id="IS 1489", type=NodeType.INDIAN_STANDARD, attributes={
                "name": "IS 1489 – Portland Pozzolana Cement",
                "active": True
            }),
            NodeData(id="IS 456", type=NodeType.INDIAN_STANDARD, attributes={
                "name": "IS 456 – Plain & Reinforced Concrete",
                "active": True
            }),
            NodeData(id="LAB-NABL-01", type=NodeType.TEST_LAB, attributes={
                "name": "Central Electronics Testing Lab",
                "lab_accreditation": LabAccreditation.VALID
            }),
            NodeData(id="LAB-SOLAR-09", type=NodeType.TEST_LAB, attributes={
                "name": "National Solar Testing Institute",
                "lab_accreditation": LabAccreditation.VALID
            }),
            NodeData(id="LAB-MAT-04", type=NodeType.TEST_LAB, attributes={
                "name": "NABL Civil Materials Lab",
                "lab_accreditation": LabAccreditation.INVALID
            }),
            NodeData(id="PROD-LED-50W", type=NodeType.PRODUCT, attributes={
                "name": "Smart Modular LED Driver 50W"
            }),
            NodeData(id="PROD-SOLAR-400W", type=NodeType.PRODUCT, attributes={
                "name": "Mono PERC Solar PV Module 400W"
            }),
            NodeData(id="PROD-CEMENT-PPC", type=NodeType.PRODUCT, attributes={
                "name": "Portland Pozzolana Cement Grade 53"
            }),
        ]

        for nd in nodes:
            self.add_node(nd)

        # ── Edges ──────────────────────────────────────────────────────
        edges = [
            # License → Manufacturer (ISSUED_TO)
            EdgeData(source="CM/L-1234567", target="MFG-Apex",       type=EdgeType.ISSUED_TO),
            EdgeData(source="CM/L-1234567", target="MFG-SunPower",   type=EdgeType.ISSUED_TO),
            EdgeData(source="CM/L-9999999", target="MFG-UltraTech",  type=EdgeType.ISSUED_TO),

            # Product → License (COVERS)
            EdgeData(source="PROD-LED-50W",     target="CM/L-1234567", type=EdgeType.COVERS),
            EdgeData(source="PROD-SOLAR-400W",  target="CM/L-1234567", type=EdgeType.COVERS),
            EdgeData(source="PROD-CEMENT-PPC",  target="CM/L-9999999", type=EdgeType.COVERS),

            # Product → Standard (CONFORMS_TO)
            EdgeData(source="PROD-LED-50W",     target="IS 13252", type=EdgeType.CONFORMS_TO),
            EdgeData(source="PROD-SOLAR-400W",  target="IS 14286", type=EdgeType.CONFORMS_TO),
            EdgeData(source="PROD-CEMENT-PPC",  target="IS 1489",  type=EdgeType.CONFORMS_TO),
            EdgeData(source="PROD-CEMENT-PPC",  target="IS 456",   type=EdgeType.CONFORMS_TO),

            # Product → TestLab (TESTED_BY)
            EdgeData(source="PROD-LED-50W",     target="LAB-NABL-01",  type=EdgeType.TESTED_BY),
            EdgeData(source="PROD-SOLAR-400W",  target="LAB-SOLAR-09", type=EdgeType.TESTED_BY),
            EdgeData(source="PROD-CEMENT-PPC",  target="LAB-MAT-04",   type=EdgeType.TESTED_BY),
        ]

        for ed in edges:
            self.add_edge(ed)


    def _load_backup(self) -> None:
        if os.path.exists(self.backup_path):
            try:
                with open(self.backup_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._rebuild_graph(data)
            except Exception:
                pass

    def _rebuild_graph(self, data: Dict[str, Any]) -> None:
        self.graph.clear()
        for node_id, node_info in data.get("nodes", {}).items():
            node_type = NodeType(node_info["type"])
            self.graph.add_node(
                node_id,
                type=node_type,
                **node_info.get("attributes", {})
            )
        for edge in data.get("edges", []):
            self.graph.add_edge(
                edge["source"],
                edge["target"],
                type=EdgeType(edge["type"]),
                **edge.get("attributes", {})
            )

    def _save_backup(self) -> None:
        data = {
            "nodes": {},
            "edges": []
        }
        for node_id, attrs in self.graph.nodes(data=True):
            node_type = attrs.get("type", NodeType.PRODUCT)
            data["nodes"][node_id] = {
                "type": node_type.value if isinstance(node_type, NodeType) else node_type,
                "attributes": {k: v for k, v in attrs.items() if k != "type"}
            }
        for source, target, attrs in self.graph.edges(data=True):
            edge_type = attrs.get("type", EdgeType.COVERS)
            data["edges"].append({
                "source": source,
                "target": target,
                "type": edge_type.value if isinstance(edge_type, EdgeType) else edge_type,
                "attributes": {k: v for k, v in attrs.items() if k != "type"}
            })

        os.makedirs(os.path.dirname(self.backup_path) or ".", exist_ok=True)
        with open(self.backup_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def add_node(self, node_data: NodeData) -> bool:
        if self.graph.has_node(node_data.id):
            return False
        attrs = {"type": node_data.type}
        attrs.update(node_data.attributes)
        self.graph.add_node(node_data.id, **attrs)
        self._save_backup()
        return True

    def update_node(self, node_id: str, attributes: Dict[str, Any]) -> bool:
        if not self.graph.has_node(node_id):
            return False
        for key, value in attributes.items():
            self.graph.nodes[node_id][key] = value
        self._save_backup()
        return True

    def add_edge(self, edge_data: EdgeData) -> bool:
        if not self.graph.has_node(edge_data.source) or not self.graph.has_node(edge_data.target):
            return False
        attrs = {"type": edge_data.type}
        attrs.update(edge_data.attributes)
        self.graph.add_edge(edge_data.source, edge_data.target, **attrs)
        self._save_backup()
        return True

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        if not self.graph.has_node(node_id):
            return None
        data = dict(self.graph.nodes[node_id])
        data["id"] = node_id
        return data

    def get_graph_data(self) -> Dict[str, Any]:
        nodes = []
        for node_id, attrs in self.graph.nodes(data=True):
            node = {"id": node_id}
            node.update({k: (v.value if isinstance(v, (NodeType, EdgeType, LicenseStatus, LabAccreditation)) else v) for k, v in attrs.items()})
            nodes.append(node)
        edges = []
        for source, target, attrs in self.graph.edges(data=True):
            edge = {"source": source, "target": target}
            edge.update({k: (v.value if isinstance(v, (NodeType, EdgeType, LicenseStatus, LabAccreditation)) else v) for k, v in attrs.items()})
            edges.append(edge)
        return {"nodes": nodes, "edges": edges}

    def verify_license(self, license_id: str, max_depth: int = 3) -> Dict[str, Any]:
        if not self.graph.has_node(license_id):
            return {
                "license_id": license_id,
                "is_legitimate": False,
                "status": "NOT_FOUND",
                "path": [],
                "broken_edges": [f"License node {license_id} does not exist in graph"],
                "details": {}
            }

        path: List[VerificationPath] = []
        broken_edges: List[str] = []
        details: Dict[str, Any] = {}
        visited: Set[str] = set()
        queue: deque = deque([(license_id, 0, [license_id])])
        visited.add(license_id)

        node_data = dict(self.graph.nodes[license_id])
        status = node_data.get("status", LicenseStatus.ACTIVE)
        expiry_date = node_data.get("expiry_date")
        today = date.today()

        if isinstance(expiry_date, str):
            try:
                expiry_date = date.fromisoformat(expiry_date)
            except ValueError:
                expiry_date = None

        hop1_ok = True
        if status != LicenseStatus.ACTIVE:
            hop1_ok = False
            broken_edges.append(f"License {license_id} status is {status}, expected ACTIVE")
        elif expiry_date and expiry_date < today:
            hop1_ok = False
            broken_edges.append(f"License {license_id} expired on {expiry_date}")

        path.append(VerificationPath(
            node_id=license_id,
            node_type=node_data.get("type", "License"),
            status="OK" if hop1_ok else "FAIL",
            details=f"Status: {status}, Expiry: {expiry_date}"
        ))
        details["license"] = {"status": status.value if isinstance(status, LicenseStatus) else status, "expiry_date": str(expiry_date) if expiry_date else None}

        if not hop1_ok:
            return {
                "license_id": license_id,
                "is_legitimate": False,
                "status": "INVALID",
                "path": [{"node_id": p.node_id, "node_type": p.node_type, "status": p.status, "details": p.details} for p in path],
                "broken_edges": broken_edges,
                "details": details
            }

        while queue:
            current_id, depth, current_path = queue.popleft()
            if depth >= max_depth:
                continue

            for neighbor in self.graph.successors(current_id):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                edge_attrs = self.graph.edges[current_id, neighbor]
                neighbor_attrs = dict(self.graph.nodes[neighbor])

                hop_ok = True
                hop_details = ""

                if current_id == license_id and edge_attrs.get("type") == EdgeType.ISSUED_TO:
                    factory_reg = neighbor_attrs.get("factory_registration_active", True)
                    if not factory_reg:
                        hop_ok = False
                        broken_edges.append(f"Manufacturer {neighbor} factory registration is not active")
                    hop_details = f"Factory registration active: {factory_reg}"

                elif edge_attrs.get("type") == EdgeType.CONFORMS_TO:
                    standard_active = neighbor_attrs.get("active", True)
                    hop_details = f"Standard active: {standard_active}"
                    if not standard_active:
                        hop_ok = False
                        broken_edges.append(f"Standard {neighbor} is not active")

                elif edge_attrs.get("type") == EdgeType.TESTED_BY:
                    lab_accred = neighbor_attrs.get("lab_accreditation", LabAccreditation.VALID)
                    hop_details = f"Lab accreditation: {lab_accred}"
                    if lab_accred != LabAccreditation.VALID:
                        hop_ok = False
                        broken_edges.append(f"Test lab {neighbor} accreditation is {lab_accred}")

                else:
                    hop_details = f"Edge type: {edge_attrs.get('type')}"

                path.append(VerificationPath(
                    node_id=neighbor,
                    node_type=neighbor_attrs.get("type", "Unknown"),
                    status="OK" if hop_ok else "FAIL",
                    details=hop_details
                ))

                if not hop_ok:
                    return {
                        "license_id": license_id,
                        "is_legitimate": False,
                        "status": "INVALID",
                        "path": [{"node_id": p.node_id, "node_type": p.node_type, "status": p.status, "details": p.details} for p in path],
                        "broken_edges": broken_edges,
                        "details": details
                    }

                queue.append((neighbor, depth + 1, current_path + [neighbor]))

        return {
            "license_id": license_id,
            "is_legitimate": True,
            "status": "VALID",
            "path": [{"node_id": p.node_id, "node_type": p.node_type, "status": p.status, "details": p.details} for p in path],
            "broken_edges": broken_edges,
            "details": details
        }

    def add_graph_node(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        node_type_raw = payload.get("node_type", "")
        # Accept both title-case ("IndianStandard") and uppercase ("INDIANSTANDARD")
        # by trying the raw value first, then matching case-insensitively against enum values
        node_type: Optional[NodeType] = None
        for nt in NodeType:
            if nt.value.lower() == node_type_raw.lower() or nt.name.lower() == node_type_raw.lower():
                node_type = nt
                break
        if node_type is None:
            valid = [nt.value for nt in NodeType]
            return {"success": False, "error": f"Invalid node_type: '{node_type_raw}'. Valid values: {valid}"}

        node_id = payload.get("node_id")
        if not node_id:
            return {"success": False, "error": "node_id is required"}

        attributes = {k: v for k, v in payload.items() if k not in ("node_type", "node_id", "edge_to", "edge_type")}
        node_data = NodeData(id=node_id, type=node_type, attributes=attributes)

        self.add_node(node_data)

        edge_to = payload.get("edge_to")
        edge_type_raw = payload.get("edge_type", "")
        if edge_to and edge_type_raw:
            edge_type: Optional[EdgeType] = None
            for et in EdgeType:
                if et.value.lower() == edge_type_raw.lower() or et.name.lower() == edge_type_raw.lower():
                    edge_type = et
                    break
            if edge_type is None:
                valid_edges = [et.value for et in EdgeType]
                return {"success": True, "node_id": node_id, "warning": f"Node added but invalid edge_type: '{edge_type_raw}'. Valid values: {valid_edges}"}
            edge_attrs = {k: v for k, v in payload.items() if k not in ("node_type", "node_id", "edge_to", "edge_type")}
            edge_data = EdgeData(source=node_id, target=edge_to, type=edge_type, attributes=edge_attrs)
            if not self.add_edge(edge_data):
                return {"success": True, "node_id": node_id, "warning": f"Node added but edge target '{edge_to}' does not exist in graph"}

        return {"success": True, "node_id": node_id}

    def clear(self) -> None:
        self.graph.clear()
        self._save_backup()
