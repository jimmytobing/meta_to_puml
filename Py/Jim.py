import xml.etree.ElementTree as ET

def parse_salesforce_flow(xml_file):
    """Membaca file metadata Flow Salesforce dan mengonversinya ke PlantUML Activity Diagram Beta Syntax."""
    tree = ET.parse(xml_file)
    root = tree.getroot()
    ns = {'md': 'http://soap.sforce.com/2006/04/metadata'}

    plantuml = [
        "@startuml",
        "<style>",
        "    element {",
        "        MinimumWidth 100",
        "        MaximumWidth 180",
        "    }",
        "    .kondisi {",
        "        FontSize 9",
        "        Padding 5",
        "        LineStyle 2",
        "        BackGroundColor transparent",
        "        HorizontalAlignment center",
        "    }",
        "</style>",
        'skinparam defaultFontName "verdana"',
        "start"
    ]

    # Variabel dan koneksi
    variables = {}
    elements = {}
    connections = {}
    decisions = {}
    record_operations = []

    # Ekstrak variabel
    for var in root.findall("md:variables", ns):
        name = var.find("md:name", ns).text
        data_type = var.find("md:dataType", ns).text
        is_input = var.find("md:isInput", ns).text == "true"
        value = var.find("md:value/md:stringValue", ns)
        variables[name] = {
            "type": data_type,
            "input": is_input,
            "value": value.text if value is not None else None
        }

    # Ekstrak semua elemen dan koneksi
    for elem in root:
        if elem.tag == f"{{{ns['md']}}}start":
            connections["start"] = elem.find("md:connector/md:targetReference", ns).text
        elif elem.tag in [f"{{{ns['md']}}}recordLookups", 
                        f"{{{ns['md']}}}decisions",
                        f"{{{ns['md']}}}loops",
                        f"{{{ns['md']}}}recordUpdates",
                        f"{{{ns['md']}}}recordCreates",
                        f"{{{ns['md']}}}assignments"]:
            name = elem.find("md:name", ns).text
            elem_type = elem.tag.split("}")[1]
            elements[name] = {"type": elem_type, "data": elem}
            
            # Simpan koneksi
            connector = elem.find("md:connector/md:targetReference", ns)
            if connector is not None:
                connections[name] = connector.text

    # Tambahkan input variable
    input_var = next((k for k, v in variables.items() if v["input"]), None)
    if input_var:
        plantuml.append(f":{input_var} = \"{variables[input_var]['value']}\";<<input>>")

    # Proses alur utama
    current = connections.get("start")
    while current:
        elem = elements.get(current)
        if not elem:
            break
            
        # Record Lookup
        if elem["type"] == "recordLookups":
            obj = elem["data"].find("md:object", ns).text
            filters = []
            for f in elem["data"].findall("md:filters", ns):
                field = f.find("md:field", ns).text
                operator = f.find("md:operator", ns).text
                value = f.find("md:value/md:elementReference", ns).text
                filters.append(f"{field} {operator} {value}")
            
            query = f"select {'top1 ' if elem['data'].find('md:getFirstRecordOnly', ns).text == 'true' else ''}from {obj}"
            if filters:
                query += "\nwhere " + " AND ".join(filters)
            
            plantuml.append(f":{current} \n----\n{query};")
            current = connections.get(current)

        # Decision
        elif elem["type"] == "decisions":
            plantuml.append(f"switch ({elem['data'].find('md:label', ns).text})")
            rules = elem["data"].findall("md:rules/md:rules", ns)
            for rule in rules:
                condition = rule.find("md:conditions/md:conditions", ns)
                left = condition.find("md:leftValueReference", ns).text
                op = condition.find("md:operator", ns).text
                right = condition.find("md:rightValue/md:numberValue", ns).text
                plantuml.append(f"case ({rule.find('md:label', ns).text})")
                plantuml.append(f"    ....\n    {left} {op} {right};<<kondisi>>")
                plantuml.append(f"    :{rule.find('md:connector/md:targetReference', ns).text};")
            
            # Default case
            default = elem["data"].find("md:defaultConnector/md:targetReference", ns)
            plantuml.append("case ()")
            plantuml.append("    :NULL;<<kondisi>>")
            plantuml.append(f"    :{default.text};")
            plantuml.append("endswitch")
            current = None  # Sudah dihandle oleh case

        # Loop
        elif elem["type"] == "loops":
            collection = elem["data"].find("md:collectionReference", ns).text
            plantuml.append(f"while({current} : {collection})")
            plantuml.append(f"    :{elem['data'].find('md:nextValueConnector/md:targetReference', ns).text};")
            plantuml.append("endwhile")
            current = connections.get(current)

        # Record Update/Create
        elif elem["type"] in ["recordUpdates", "recordCreates"]:
            obj = elem["data"].find("md:object", ns).text
            action = "Update" if elem["type"] == "recordUpdates" else "Upsert"
            inputs = []
            for ia in elem["data"].findall("md:inputAssignments", ns):
                field = ia.find("md:field", ns).text
                value = ia.find("md:value/md:stringValue", ns) or ia.find("md:value/md:elementReference", ns)
                inputs.append(f"{field} = {value.text}")
            
            # Filter untuk update
            filters = []
            for f in elem["data"].findall("md:filters", ns):
                value = f.find("md:value/md:elementReference", ns).text
                filters.append(f"{f.find('md:field', ns).text} = {value}")
            
            if action == "Upsert":
                conflict_field = elem["data"].find("md:filters/md:field", ns).text
                plantuml.append(f":{action} {obj} \n----\nSet {', '.join(inputs)}\non conflict ({conflict_field}) = \"{elem['data'].find('md:filters/md:stringValue', ns).text}\";")
            else:
                plantuml.append(f":{action} {obj} \n----\nSet {', '.join(inputs)}" + 
                               (f"\nwhere {' AND '.join(filters)}" if filters else "") + ";")
            
            current = connections.get(current)

        # Assignment
        elif elem["type"] == "assignments":
            assignment = elem["data"].find("md:assignmentItems/md:assignmentItems", ns)
            var = assignment.find("md:assignToReference", ns).text
            value = assignment.find("md:value/md:*", ns)
            value_txt = value.text if value is not None else ""
            plantuml.append(f":{var} = \"{value_txt}\";")
            current = connections.get(current)

    # Output variable
    output_var = next((k for k, v in variables.items() if not v["input"] and v.get('isOutput')), None)
    if output_var:
        plantuml.append(f":{output_var};<<output>>")

    plantuml.extend(["stop", "@enduml"])
    return "\n".join(plantuml)

# Contoh penggunaan
xml_file_path = "Gen_Python.flow-meta.xml"
output_file = "Gen_Python.flow-meta-D.puml"

plantuml_code = parse_salesforce_flow(xml_file_path)
with open(output_file, "w") as f:
    f.write(plantuml_code)

print(f"PlantUML berhasil dibuat: {output_file}")