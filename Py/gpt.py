import xml.etree.ElementTree as ET

def parse_salesforce_xml(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    plantuml_output = ["@startuml"]
    
    # Menangani variabel
    variables = root.findall(".//variables")
    for var in variables:
        name = var.find("name").text
        value = var.find("value/stringValue")
        value_text = value.text if value is not None else ""  
        plantuml_output.append(f":{name} = \"{value_text}\";")
    
    # Menangani record lookups
    lookups = root.findall(".//recordLookups")
    for lookup in lookups:
        name = lookup.find("name").text
        object_type = lookup.find("object").text
        plantuml_output.append(f":{name} = select * from {object_type};")
    
    # Menangani assignments
    assignments = root.findall(".//assignments")
    for assign in assignments:
        label = assign.find("label").text
        plantuml_output.append(f":{label};")
        for item in assign.findall("assignmentItems"):
            ref = item.find("assignToReference").text
            value = item.find("value/stringValue")
            value_text = value.text if value is not None else ""  
            plantuml_output.append(f"    {ref} = \"{value_text}\";")
    
    # Menangani decision (switch case)
    decisions = root.findall(".//decisions")
    for decision in decisions:
        label = decision.find("label").text
        plantuml_output.append(f"switch ({label})")
        for rule in decision.findall("rules"):
            rule_label = rule.find("label").text
            plantuml_output.append(f"    case ({rule_label})")
    
    plantuml_output.append("@enduml")
    return "\n".join(plantuml_output)

def convert_xml_to_md(input_xml, output_md):
    plantuml_code = parse_salesforce_xml(input_xml)
    with open(output_md, "w", encoding="utf-8") as file:
        file.write(plantuml_code)
    print(f"File berhasil dikonversi ke {output_md}")

# Contoh penggunaan
convert_xml_to_md("Apate.flow-meta.xml", "Apate.md")
