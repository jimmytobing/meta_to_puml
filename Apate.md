@startuml
:recordId_Acc = "001dM000002F6C8QAK";
:varS_Input = ""Input Baru"";
:varS_Output = "";
:varS_Rating = "";
:cur_Acc = select * from Account;
:rst_Contact = select * from Contact;
:rst_Opty = select * from Opportunity;
:set IsPriorityRecord;
    c.IsPriorityRecord = "";
:set Output;
    varS_Output = "Warmer Keren";
:set Rating Cold;
    varS_Rating = "Cold";
    varS_Output = "Colder";
:set Rating Hot;
    varS_Rating = "Hot";
    varS_Output = "Hotter";
:set Rating Warm;
    varS_Rating = "Warm";
    varS_Output = "Warmer";
switch (cek Amount)
    case (Keren)
switch (cek Karyawan)
    case (Big Size)
    case (Medium Size)
@enduml