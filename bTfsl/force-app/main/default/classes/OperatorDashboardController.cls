public with sharing class OperatorDashboardController {
    @AuraEnabled(cacheable=true)
    public static List<Service_Appointment__c> getAppointmentsForResource(Id resourceId) {
        return [
            SELECT Id, Name, Subject__c, Status__c, Scheduled_Start__c, Scheduled_End__c, Work_Order__c
            FROM Service_Appointment__c
            WHERE Service_Resource__c = :resourceId
            ORDER BY Scheduled_Start__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Service_Resource__c> getAvailableResources() {
        return [
            SELECT Id, Name
            FROM Service_Resource__c
            WHERE Active__c = TRUE 
        ];
    }

    @AuraEnabled
    public static void createResourceAbsence(Id resourceId, Date startDate, Date endDate, String reason, String absenceType) {
        Resource_Absent__c absence = new Resource_Absent__c(
            Resource_Name__c = resourceId,
            Start_Date__c = startDate,
            End_Date__c = endDate,
            Reason__c = reason,
            Type_of_Absence__c = absenceType
        );
        insert absence;
    }

    @AuraEnabled(cacheable=true)
    public static string getTimesheetsForResourceNew(Id resourceId) {
        List<Timesheet__c> timesheet= [SELECT Id, Name, Work_Date__c,Start_Time__c,End_Time__c, 
                Status__c, Break_Duration__c, Total_Hours_Worked__c 
                FROM Timesheet__c 
                WHERE Service_Resource__c = :resourceId 
                ORDER BY Work_Date__c DESC];
        return json.serialize(timesheet);
    }

     //  Get Required Products for Work Order (read-only)
    @AuraEnabled(cacheable=true)
    public static List<Required_Product__c> getRequiredProducts(Id workOrderId) {
        return [
            SELECT Id, Product__c, Quantity_Required__c, Quantity_Unit_Of_Measure__c
            FROM Required_Product__c
            WHERE 	Work_Order__c = :workOrderId
        ];
    }

    //  Get Consumed Products for Work Order
    @AuraEnabled(cacheable=true)
    public static List<Consumed_Product__c>  getConsumedProducts(Id recordId) {
            List<Consumed_Product__c> consumed = [
            SELECT Id, Name, Product__r.Name, Product_Item__r.Name, Quantity_Consumed__c, Description__c
            FROM Consumed_Product__c
            WHERE Id = :recordId 
        ];
        return consumed;
    }


    // Get Related Work Order Info (with Account, Contact, Asset)
    @AuraEnabled(cacheable=true)
    public static String getWorkOrderDetails(Id workOrderId) {
        Work_Order__c wo = [
            SELECT Id, Name, Subject__c, Description__c, Status__c,
                   Account__r.Name, Contact__r.Name, Asset__r.Name, Case__r.CaseNumber
            FROM Work_Order__c
            WHERE Id = :workOrderId
            LIMIT 1
        ];
        return JSON.serialize(wo);
    }
    
    @AuraEnabled
    public static String createTimesheet(Timesheet__c ts) {
        insert ts;

        // Re-query the inserted record with necessary fields
        Timesheet__c updatedTs = [SELECT Id, Work_Date__c, Start_Time__c, End_Time__c, Work_Status__c, Break_Duration__c, Description__c, Status__c, Service_Resource__c,Related_Work_Order__c
            FROM Timesheet__c
            WHERE Id = :ts.Id
            LIMIT 1
        ];
        return json.serialize(updatedTs);
    }

    @AuraEnabled
    public static void createRescheduledAppointment(
        Datetime start, 
        Datetime endtime, 
        String reason, 
        String workOrderId, 
        String appointmentId
    ) {
        // Fetch the appointment using both IDs
        List<Service_Appointment__c> apptList = [
            SELECT Id, Scheduled_Start__c, Scheduled_End__c, Reschedule_Reason__c, Status__c, Schedule_status__c 
            FROM Service_Appointment__c 
            WHERE Id = :appointmentId AND Work_Order__c = :workOrderId 
            LIMIT 1
        ];

        if (apptList.isEmpty()) {
            throw new AuraHandledException('No matching Service Appointment found for the provided Appointment ID and Work Order ID.');
        }

        // Update the fields
        Service_Appointment__c appt = apptList[0];
        appt.Scheduled_Start__c = start;
        appt.Scheduled_End__c = endtime;
        appt.Reschedule_Reason__c = reason;
        appt.Status__c = 'Schedule';
        appt.Schedule_status__c = 'Rescheduled';

        update appt;
    }

}
