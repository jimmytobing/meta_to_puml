@startuml
skinparam defaultFontName "verdana"
start
:start(start) --> cur_Acc;
:cur_Acc(recordLookups) --> rst_Opty;
:rst_Opty(recordLookups) --> cek_Karyawan;
switch (cek_Karyawan)
    case (Big_Size)
        :Big_Size(rules) --> set_Rating_Hot;
        :set_Rating_Hot(assignments) --> set_Hot_Amount;
        :set_Hot_Amount(transforms) --> rst_Contact;
    case (Medium_Size)
        :Medium_Size(rules) --> set_Rating_Warm;
        :set_Rating_Warm(assignments) --> set_Warm_Amount;
        :set_Warm_Amount(transforms) --> rst_Contact;
    case (Small Size)
        :Small Size(rules) --> set_Rating_Cold;
        :set_Rating_Cold(assignments) --> set_Cold_Amount;
        :set_Cold_Amount(transforms) --> rst_Contact;
endswitch
:rst_Contact(recordLookups) --> c;
while(c)
    :set_IsPriorityRecord --> c;
endwhile
:c --> save_Contact;
:save_Contact --> update_Account;
:update_Account --> upsert_Account;
:upsert_Account --> stop;
stop
@enduml