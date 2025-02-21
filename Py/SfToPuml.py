import xml.etree.ElementTree as ET

def parse_salesforce_flow(xml_file):
    """Membaca file metadata Flow Salesforce dan mengonversinya ke PlantUML Activity Diagram Beta Syntax."""
    tree = ET.parse(xml_file)
    root = tree.getroot()

    # Namespace Salesforce di XML
    ns = {'md': 'http://soap.sforce.com/2006/04/metadata'}

    # Ambil elemen-elemen Flow
    elements = root.findall("md:elements", ns)

    plantuml = ["@startuml", "<style>", "    element {", "        MinimumWidth 100", "        MaximumWidth 180", "    }", "    .kondisi {", "        FontSize 9", "        Padding 5", "        LineStyle 2", "        BackGroundColor transparent", "        HorizontalAlignment center", "    }", "</style>", "skinparam defaultFontName \"verdana\"", "start"]

    # Simpan koneksi antar elemen
    element_map = {}
    decisions = {}
    loops = {}
    assignments = {}

    for element in elements:
        name = element.find("md:name", ns).text
        element_type = element.find("md:elementType", ns).text

        element_map[name] = {"type": element_type, "connections": []}

        if element_type == "Decision":
            decisions[name] = []
            for outcome in element.findall("md:outcome", ns):
                outcome_name = outcome.find("md:name", ns).text
                target = outcome.find("md:connector/md:targetReference", ns)
                if target is not None:
                    decisions[name].append((outcome_name, target.text))

        elif element_type == "Loop":
            loop_condition = element.find("md:loopCondition", ns).text
            loops[name] = loop_condition

        elif element_type == "Assignment":
            var_name = element.find("md:variable", ns).text
            value = element.find("md:value", ns).text
            assignments[name] = f":{var_name} := {value};"

        # Cek apakah ada koneksi langsung (default flow)
        target = element.find("md:connector/md:targetReference", ns)
        if target is not None:
            element_map[name]["connections"].append(target.text)

    # Tambahkan elemen awal
    start_element = next((k for k, v in element_map.items() if v["type"] == "Screen"), None)
    if start_element:
        plantuml.append(f":{start_element};")

    # Tambahkan decision node dengan format if-else yang benar
    for decision, outcomes in decisions.items():
        plantuml.append(f"if ({decision}?) then (Yes)")
        for outcome_name, target in outcomes:
            if outcome_name == "Yes":
                plantuml.append(f"  :{target};")
            else:
                plantuml.append("else (No)")
                plantuml.append("  end")
        plantuml.append("endif")

    # Tambahkan loop node dengan format while yang benar
    for loop_name, condition in loops.items():
        plantuml.append(f"while ({condition}) is (Yes)")
        plantuml.append(f"  :{loop_name};")
        plantuml.append("endwhile")

    # Tambahkan assignment node
    for assign_name, expression in assignments.items():
        plantuml.append(expression)

    plantuml.append("stop")
    plantuml.append("@enduml")

    return "\n".join(plantuml)

# Contoh penggunaan
xml_file_path = "Gen_Python.flow-meta.xml"
plantuml_code = parse_salesforce_flow(xml_file_path)

# Simpan ke file .puml
output_file = "Gen_Python.flow-meta.puml"
with open(output_file, "w") as f:
    f.write(plantuml_code)

print(f"PlantUML berhasil dibuat: {output_file}")
