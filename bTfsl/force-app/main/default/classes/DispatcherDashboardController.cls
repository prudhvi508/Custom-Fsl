/**
* @File Name : DispatcherDashboardController.cls
* @Description :
* @Author :
* @Last Modified By :
* @Last Modified On : June 12, 2025
* @Modification Log :
*==============================================================================
* Ver | Date | Author | Modification
*==============================================================================
* 1.0 | June 12, 2025 |   | Initial Version
**/

public with sharing class DispatcherDashboardController {
    @AuraEnabled(cacheable=true)
    public static List<Work_Order__c> getUnassignedWorkOrders(String status) {
        return [SELECT Id, Name, Status__c, Subject__c, Start_Date__c, End_Date__c, Priority__c FROM Work_Order__c WHERE Status__c =: status];
    }

    @AuraEnabled(cacheable=true)
    public static List<Service_Resource__c> getAvailableResources() {
        return [SELECT Id, Name, Resource_Type__c FROM Service_Resource__c WHERE Active__c = true];
    }

    @AuraEnabled
    public static void createServiceAppointment(Id workOrderId, Id resourceId) {
        // Validate inputs
        if (workOrderId == null || resourceId == null) {
            throw new AuraHandledException('Work Order and Resource must be provided.');
        }

        // Get Work Order
        Work_Order__c wo = [SELECT Id, Subject__c, Duration__c, Start_Date__c, End_Date__c, Case__c, Account__c, Contact__c
                        FROM Work_Order__c WHERE Id = :workOrderId LIMIT 1];

        // Create Service Appointment
        Service_Appointment__c sa = new Service_Appointment__c();
        sa.Work_Order__c = wo.Id;
        sa.Case__c = wo.Case__c;
        sa.Account__c = wo.Account__c;
        sa.Contact__c = wo.Contact__c;
        sa.Subject__c = wo.Subject__c;
        sa.Duration__c = wo.Duration__c;
        sa.Scheduled_End__c = wo.End_Date__c;
        sa.Scheduled_Start__c = wo.Start_Date__c;
        sa.Service_Resource__c = resourceId;
        sa.Status__c = 'Schedule';
        sa.Reschedule_Reason__c = 'Scheduled';
        insert sa;

        //create Assigned Resources
        Assigned_Resource__c ar = new Assigned_Resource__c();
           ar.Service_Appointment__c = sa.Id;
           ar.Service_Resource__c = sa.Service_Resource__c;
           insert ar;
                    
           // Update Work Order status to 'In Progress'
        wo.Status__c = 'Scheduled';
        update wo;
    }

    @AuraEnabled(cacheable=true)
    public static Integer getTodaysServiceAppointmentCount() {
        Date today = Date.today();
        List<Service_Appointment__c> appointment = [SELECT Id FROM Service_Appointment__c WHERE DAY_ONLY(Scheduled_Start__c) = :today];
        return appointment.size();
    }

    @AuraEnabled(cacheable=true)
    public static List<Work_Order__c> getWorkOrdersByStartDate(Date startDate, Date endDate, String status) {
        // Validate inputs if needed
        if (startDate == null || endDate == null) return new List<Work_Order__c>();

        // Make sure endDate includes the full day
        DateTime startDateTime = DateTime.newInstance(startDate, Time.newInstance(0, 0, 0, 0));
        DateTime endDateTime = DateTime.newInstance(endDate.addDays(1), Time.newInstance(0, 0, 0, 0));

        return [
            SELECT Id, Name, Status__c, Priority__c, Start_Date__c, End_Date__c
            FROM Work_Order__c
            WHERE Start_Date__c >= :startDateTime AND Start_Date__c < :endDateTime AND Status__c = :status
            ORDER BY Start_Date__c DESC
        ];
    }


}