import xml.etree.ElementTree as ET

def parse_salesforce_flow(xml_file):
    """Membaca file metadata Flow Salesforce dan mengonversinya ke PlantUML Activity Diagram."""
    tree = ET.parse(xml_file)
    root = tree.getroot()

    # Namespace Salesforce di XML
    ns = {'md': 'http://soap.sforce.com/2006/04/metadata'}

    plantuml = ["@startuml", "<style>", "    element {", "        MinimumWidth 100", "        MaximumWidth 180", "    }", "    .kondisi {", "        FontSize 9", "        Padding 5", "        LineStyle 2", "        BackGroundColor transparent", "        HorizontalAlignment center", "    }", "</style>", "skinparam defaultFontName \"verdana\"", "start"]

    # Ambil variabel input
    for variable in root.findall("md:variables", ns):
        name = variable.find("md:name", ns).text
        value = variable.find("md:value/md:stringValue", ns)
        if value is not None:
            plantuml.append(f":{name} = \"{value.text}\";<<input>>")

    # Ambil recordLookups
    for lookup in root.findall("md:recordLookups", ns):
        name = lookup.find("md:name", ns).text
        object_name = lookup.find("md:object", ns).text
        field = lookup.find("md:filters/md:field", ns).text
        value = lookup.find("md:filters/md:value/md:elementReference", ns).text
        plantuml.append(f":{name} \n----\nselect top1 from {object_name} \nwhere {field} = {value};")

    # Ambil decision
    for decision in root.findall("md:decisions", ns):
        name = decision.find("md:name", ns).text
        plantuml.append(f"switch ({name})")
        for rule in decision.findall("md:rules", ns):
            rule_name = rule.find("md:name", ns).text
            condition = rule.find("md:conditions/md:leftValueReference", ns).text
            operator = rule.find("md:conditions/md:operator", ns).text
            value = rule.find("md:conditions/md:rightValue/md:numberValue", ns).text
            target = rule.find("md:connector/md:targetReference", ns).text
            plantuml.append(f"case ()\n    :{rule_name}\n    ....\n    {condition} {operator} {value};<<kondisi>>\n    :{target};")
        plantuml.append("endswitch")

    # Ambil loops
    for loop in root.findall("md:loops", ns):
        name = loop.find("md:name", ns).text
        collection = loop.find("md:collectionReference", ns).text
        plantuml.append(f"while({name} : {collection})")
        next_value = loop.find("md:nextValueConnector/md:targetReference", ns).text
        plantuml.append(f"    :{next_value} = True;")
        plantuml.append("endwhile")

    # Ambil recordUpdates
    for update in root.findall("md:recordUpdates", ns):
        name = update.find("md:name", ns).text
        object_name = update.find("md:object", ns).text
        plantuml.append(f":Update {object_name} \n----")
        for assignment in update.findall("md:inputAssignments", ns):
            field = assignment.find("md:field", ns).text
            value = assignment.find("md:value/md:stringValue", ns)
            if value is not None:
                plantuml.append(f"Set {field} = \"{value.text}\",")
            else:
                element_ref = assignment.find("md:value/md:elementReference", ns).text
                plantuml.append(f"Set {field} = {element_ref},")
        plantuml.append("where Id = recordId_Acc;")

    # Ambil recordCreates (Upsert)
    for create in root.findall("md:recordCreates", ns):
        name = create.find("md:name", ns).text
        object_name = create.find("md:object", ns).text
        plantuml.append(f":Upsert {object_name} \n----")
        for assignment in create.findall("md:inputAssignments", ns):
            field = assignment.find("md:field", ns).text
            value = assignment.find("md:value/md:stringValue", ns)
            if value is not None:
                plantuml.append(f"Set {field} = \"{value.text}\",")
            else:
                element_ref = assignment.find("md:value/md:elementReference", ns).text
                plantuml.append(f"Set {field} = {element_ref},")
        plantuml.append(f"on conflict ({field}) = \"{value.text}\";")

    # Ambil variabel output
    for variable in root.findall("md:variables", ns):
        name = variable.find("md:name", ns).text
        is_output = variable.find("md:isOutput", ns).text
        if is_output == "true":
            plantuml.append(f":{name};<<output>>")

    plantuml.append("stop")
    plantuml.append("@enduml")

    return "\n".join(plantuml)

# Contoh penggunaan
xml_file_path = "Gen_Python.flow-meta.xml"
plantuml_code = parse_salesforce_flow(xml_file_path)

# Simpan ke file .puml
output_file = "ExampleFlow3.puml"
with open(output_file, "w") as f:
    f.write(plantuml_code)

print(f"PlantUML berhasil dibuat: {output_file}")
