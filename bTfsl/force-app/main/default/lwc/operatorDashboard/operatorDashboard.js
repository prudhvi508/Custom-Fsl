import { LightningElement, track, wire } from 'lwc';
import getAppointmentsForResource from '@salesforce/apex/OperatorDashboardController.getAppointmentsForResource';
import getAvailableResources from '@salesforce/apex/OperatorDashboardController.getAvailableResources';
import createResourceAbsence from '@salesforce/apex/OperatorDashboardController.createResourceAbsence';
import getRequiredProducts from '@salesforce/apex/OperatorDashboardController.getRequiredProducts';

import getWorkOrderDetails from '@salesforce/apex/OperatorDashboardController.getWorkOrderDetails';
import getTimesheetsForResourceNew from '@salesforce/apex/OperatorDashboardController.getTimesheetsForResourceNew';
import getConsumedProducts from '@salesforce/apex/OperatorDashboardController.getConsumedProducts';
import createTimesheet from '@salesforce/apex/OperatorDashboardController.createTimesheet';
import createRescheduledAppointment from '@salesforce/apex/OperatorDashboardController.createRescheduledAppointment';
import { refreshApex } from "@salesforce/apex";
import { createRecord } from 'lightning/uiRecordApi';
import CONSUMED_PRODUCT_OBJECT from '@salesforce/schema/Consumed_Product__c';
import CONSUMED_FIELD from '@salesforce/schema/Consumed_Product__c.Consumed__c';
import QUANTITY_FIELD from '@salesforce/schema/Consumed_Product__c.Quantity_Consumed__c';
import DESCRIPTION_FIELD from '@salesforce/schema/Consumed_Product__c.Description__c';
import WORKORDER_FIELD from '@salesforce/schema/Consumed_Product__c.Work_Order__c';
import PRODUCTITEM_FIELD from '@salesforce/schema/Consumed_Product__c.Product_Item__c'

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class OperatorDashboard extends LightningElement {
    @track appointments = [];
    @track resourceOptions = [];
    @track selectedResourceId;
    @track currentWorkOrderId;
    @track currentWorkOrdersId;
    @track currentResourceId;
    @track CurrentAppointmentName;
    @track CurrentAppointmentId;
    
    @track isLoading = false;
    @track error;

    @track showLeaveModal = false;
    @track showTimesheetsModal = false;
    @track showJobModal = false;
    @track showRelatedModal = false;
    @track relatedWorkDetails =false;

    @track leaveStartDate;
    @track leaveEndDate;
    @track leaveReason;
    @track selectedType;
    @track typeOptions = [
        { label: 'Sick Leave', value: 'Sick' },
        { label: 'Vacation', value: 'Vacation' },
        { label: 'Other', value: 'Other' }
    ];

    @track requiredProducts = [];
    @track consumedProducts = [];
    @track createdConsumedProducts = []; 
    @track showConsumedProductForm = false;
    @track consumedProductForm = {};
   
    @track productItemSearchText = null;
    @track productOptions = [];
    @track showProductDropdown = false;
    @track searchTermResult = [];
    @track consumedDescription = null;
    @track quantityConsumed = '';

    @track currentWorkOrderId;

    @track relatedWorkData = {};
    @track timesheets = [];

    @track showTimesheetForm = false;
    @track timesheetForm = {};
    @track relatedTimesheets = [];
    @track createdTimesheet = true;
    @track isFormVisible = false;
    @track isSheetsFormVisible = false;
    @track selectedStatus = '';

     timesheetColumns = [
        { label: 'Date', fieldName: 'Work_Date__c', type: 'date' },
        { label: 'Start Time', fieldName: 'Start_Time__c', type: 'time',typeAttributes: { timeStyle: 'short' } },
        { label: 'End Time', fieldName: 'End_Time__c', type: 'time',typeAttributes: { timeStyle: 'short' } },
        { label: 'Break Duration', fieldName: 'Break_Duration__c', type: 'number' },
        { label: 'Work Status', fieldName: 'Work_Status__c', type: 'text' },
        { label: 'Description', fieldName: 'Description__c', type: 'text' },        
    ];

    consumedProductColumns = [
        { label: 'Product Item', fieldName: 'Product_Item__r_Name', type: 'text' },
        { label: 'Quantity', fieldName: 'Quantity_Consumed__c', type: 'number' },
        { label: 'Description', fieldName: 'Description__c', type: 'text' }
    ] 
    

    connectedCallback() {
        this.loadResources();
    }

    async loadResources() {
        try {
            const result = await getAvailableResources();
            this.resourceOptions = result.map(res => ({
                label: res.Name,
                value: res.Id
            }));
        } catch (err) {
            this.error = 'Error loading resources';
            console.error(err);
        }
    }

    async loadAppointments() {
        this.isLoading = true;
        this.appointments = [];
        try {
            const data = await getAppointmentsForResource({ resourceId: this.selectedResourceId });
            this.appointments = data.map(appt => ({
                ...appt,
                ScheduledStart: appt.Scheduled_Start__c 
                    ? new Date(appt.Scheduled_Start__c).toLocaleString() 
                    : '',
                ScheduledEnd: appt.Scheduled_End__c 
                    ? new Date(appt.Scheduled_End__c).toLocaleString() 
                    : ''
            }));
        } catch (err) {
            this.error = err.body?.message || err.message;
        } finally {
            this.isLoading = false;
        }
    }

    handleResourceChange(event) {
        this.selectedResourceId = event.detail.value;
        this.loadAppointments();
    }

    handleLeaveClick() {
        this.showLeaveModal = true;
        this.leaveStartDate = null;
        this.leaveEndDate = null;
        this.leaveReason = '';
        this.selectedType = null;
    }

    handleTimesheetsClick() {
        this.loadTimesheets();
        this.showTimesheetsModal = true;
        //this.loadTimesheets();
    }

    closeLeaveModal() {
        this.showLeaveModal = false;
    }

    closeTimesheetsModal() {
        this.showTimesheetsModal = false;
    }

    handleInputChange(event) {
        const { name, value } = event.target;
        if (name === 'start') this.leaveStartDate = value;
        if (name === 'end') this.leaveEndDate = value;
        if (name === 'reason') this.leaveReason = value;
        if (name === 'type') this.selectedType = value;
    }

    async submitLeave() {
        if (!this.leaveStartDate || !this.leaveEndDate || !this.selectedType) {
            this.showToast('Validation Error', 'Start Date, End Date, and Type are required.', 'error');
            return;
        }
        try {
            await createResourceAbsence({
                resourceId: this.selectedResourceId,
                startDate: this.leaveStartDate,
                endDate: this.leaveEndDate,
                reason: this.leaveReason,
                absenceType: this.selectedType
            });
            this.showToast('Success', 'Leave created successfully.', 'success');
            this.closeLeaveModal();
        } catch (err) {
            this.showToast('Error', err.body?.message || 'Failed to create leave.', 'error');
        }
    }

    handleJobClick(event) {
        const appointmentId = event.target.dataset.id;
        console.log('Clicked on Job with ID: ' + appointmentId);
        const appointment = this.appointments.find(appt => appt.Id === appointmentId);
        console.log('Appointment: ' + appointment.Work_Order__c);
        if (appointment?.Work_Order__c) {
            this.currentWorkOrdersId = appointment.Work_Order__c;
            this.loadRequiredAndConsumed(this.currentWorkOrdersId);
            this.showJobModal = true;
        }
    }

    handleRelatedWorkClick(event) {
        const appointmentId = event.target.dataset.id;
        const appointment = this.appointments.find(appt => appt.Id === appointmentId);
        console.log('Appointment: ' + appointment.Name);
        this.currentWorkOrderId = appointment.Work_Order__c;
        this.currentResourceId = appointment.Service_Resource__c;
        this.CurrentAppointmentName = appointment.Name;
        this.CurrentAppointmentId = appointment.Id;
        if (appointment?.Work_Order__c) {
            this.loadRelatedWork(appointment.Work_Order__c);          
            this.showRelatedModal = true;
        }
    }

    async loadRequiredAndConsumed(workOrderId) {
        try {
            // Fetch Required Products only
            const required = await getRequiredProducts({ workOrderId });
            this.requiredProducts = required;

            // Set up state to show newly created Consumed Products only
            this.createdConsumedProducts = [];

            // Optionally store active work order ID
            this.activeWorkOrderId = workOrderId;

        } catch (err) {
            console.error('Error loading products: ', err);
        }
    }

    toggleFormVisibility(){
        this.isFormVisible = !this.isFormVisible;
        this.showConsumedProductForm = false;
    }

     handleAddConsumedProduct() {
        // Show the Consumed Product creation form
        this.isFormVisible = true;
        this.showConsumedProductForm = true;

        // Optionally reset the form values if needed
        this.consumedProductForm = {
            Product__c: null,
            Quantity_Consumed__c: null,
            Description__c: ''
        };
    }

    handleProductItemChange(event) {
        this.productItemSearchText = event.detail.recordId;
        console.log('Search productItem text: ' + this.productItemSearchText);
    }

    handleConsumedChange(event) {
        this.quantityConsumed = event.target.value;
    }

     // Handle input changes
    handleConsumedInputChange(event) {
        this.consumedDescription = event.target.value;
    }

    async submitConsumedProduct() {
        const fields = {};
        fields[QUANTITY_FIELD.fieldApiName] = this.quantityConsumed;
        fields[DESCRIPTION_FIELD.fieldApiName] = this.consumedDescription;
        fields[WORKORDER_FIELD.fieldApiName] = this.currentWorkOrdersId;
        fields[PRODUCTITEM_FIELD.fieldApiName] = this.productItemSearchText;
        fields[CONSUMED_FIELD.fieldApiName] = true;

        const recordInput = { apiName: CONSUMED_PRODUCT_OBJECT.objectApiName, fields };

        try {
            const createResult = await createRecord(recordInput);
            console.log('Create Result: ' + JSON.stringify(createResult));
            const createRecordId = createResult.id;
            console.log('Created Consumed Product with ID: ' + createRecordId);
            const getResult = await getConsumedProducts({ recordId: createRecordId});
            console.log('Get Result: ' + JSON.stringify(getResult));
            this.createdConsumedProducts = [(getResult)].map(item => ({
                                                Id: item.Id,
                                                Product_Item__c: item.Product_Item__c,
                                                Product_Item__r_Name: item.Product_Item__r?.Name || '',
                                                Quantity_Consumed__c: item.Quantity_Consumed__c,
                                                Description__c: item.Description__c
                                            }));
            console.log('Consumed Product created: ', JSON.stringify(this.createdConsumedProducts));
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Consumed Product created',
                    variant: 'success',
                })
            );
            this.showConsumedProductForm = false;
            this.loadReset();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error creating record',
                    message: error.body.message,
                    variant: 'error',
                })
            );
        }
    }

    loadReset(){
        this.consumedProductForm = {
            Product__c: null,
            Quantity_Consumed__c: null,
            Description__c: ''
        };
    }

    async loadRelatedWork(workOrderId) {
        this.relatedWorkDetails = true;
        try {
            const resultWO = await getWorkOrderDetails({ workOrderId });
            const parsedResult = JSON.parse(resultWO);

            this.relatedWorkData = {
                ...parsedResult,
                account: parsedResult.Account__r?.Name || '',
                contact: parsedResult.Contact__r?.Name || '',
                asset: parsedResult.Asset__r?.Name || '',
                case: parsedResult.Case__r?.CaseNumber || ''
            };

            this.relatedWorkDetails = true;
        } catch (err) {
            console.error('Error loading related work data: ', err);
        }
        this.relatedTimesheets = [];
    }

    handleAddTimesheet() {
        this.isSheetsFormVisible = true;
        this.showTimesheetForm = true;
        this.timesheetForm = {
            Work_Date__c: '',
            Work_Status__c: '',
            Break_Duration__c: '',
            Start_Time__c: '',
            End_Time__c: '',
            Description__c: ''
        };
    }

    toggleTimesheetsFormVisibility() {
        this.isSheetsFormVisible = !this.isSheetsFormVisible;
        this.showTimesheetForm = false;
    }
     
    handleTimesheetInputChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        this.timesheetForm = {
            ...this.timesheetForm,
           [field]: value
        };
    }


    cancelTimesheetForm() {
        this.showTimesheetForm = false;
    }

     get statusOptions() {
        return [
            { label: 'None', value: '' },
            { label: 'In Progress', value: 'In Progress' },
            { label: 'Completed', value: 'Completed' }
        ];
    }

    handleStatusChange(event) {
        this.selectedStatus = event.detail.value;
        console.log('Selected Status:', this.selectedStatus);
    }

    async submitTimesheet() {
        const requiredFields = ['Work_Date__c', 'Start_Time__c', 'End_Time__c'];
        const isValid = requiredFields.every(field => this.timesheetForm[field]);

        if (!isValid) {
            this.showToast('Validation Error', 'Work Date, Start Time, and End Time are required.', 'error');
            return;
        }

        try {
            const record = {
                ...this.timesheetForm,
                Service_Resource__c: this.selectedResourceId,
                Related_Work_Order__c: this.currentWorkOrderId,
                Status__c: 'Submitted',
                Work_Status__c: this.selectedStatus
            };

            console.log('resource and Work order ' + this.selectedResourceId + ' ' + this.currentWorkOrderId);

            const result = await createTimesheet({ ts: record }); 
            console.log('Timesheet returned from Apex:', JSON.stringify(result));

            const parsed = JSON.parse(result);
            this.relatedTimesheets = Array.isArray(parsed) ? parsed : [parsed];
            console.log('Assigned to datatable:', JSON.stringify(this.relatedTimesheets));

            this.createdTimesheet = true;
            this.showTimesheetForm = false;
            await refreshApex(this.relatedTimesheets);
            this.showToast('Success', 'Timesheet created successfully.', 'success');

        } catch (err) {
            console.error('error' ,JSON.stringify(err));
            this.showToast('Error', err.body?.message || 'Failed to create timesheet.', 'error');
        }
    }

    async loadTimesheets() {
        try {
            const sheets = await getTimesheetsForResourceNew({ resourceId: this.selectedResourceId });
            this.timesheets = JSON.parse(sheets); 
        } catch (err) {
            console.error('Error loading timesheets: ', err);
        }
    }

    handleConsumedInputChange(event) {
        const field = event.target.name;
        const value = event.target.value;

        this.consumedProductForm = {
            ...this.consumedProductForm,
            [field]: value
        };
    }

    closeJobModal() {
        this.showJobModal = false;
    }

    closeRelatedModal() {
        this.showRelatedModal = false;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    get isLeaveDisabled() {
        return this.isLoading || !this.selectedResourceId;
    }

    @track showRescheduleModal = false;
    @track rescheduleWorkOrderId ;
    @track rescheduleAppointmentId;
    startDate = '';
    endDate = '';
    reason = '';

    handleRescheduleclick(event) {
        const serviceAppointmentId = event.target.dataset.id;
        const serviceAppointment = this.appointments.find(appt => appt.Id === serviceAppointmentId);
        this.rescheduleWorkOrderId = serviceAppointment.Work_Order__c;
        this.rescheduleAppointmentId = serviceAppointment.Id;
        console.log('work order', this.rescheduleAppointmentId);
    
         if (serviceAppointment?.Work_Order__c) {       
            this.showRescheduleModal = true;
        }
    }

    closeRescheduleModal() {
        this.showRescheduleModal = false;
        this.resetRescheduleFields();
    }

    handleRescheduleInputChange(event) {
        const { name, value } = event.target;
        if (name === 'startDate') this.startDate = value;
        else if (name === 'endDate') this.endDate = value;
        else if (name === 'reason') this.reason = value;
    }

    handleRescheduleSubmit() {
        console.log("Entered values", this.startDate, this.endDate, this.reason);
        console.log("AppointmentId:", this.rescheduleAppointmentId);
        console.log("WorkOrderId:", this.rescheduleWorkOrderId);

        if (!this.startDate || !this.endDate || !this.reason) {
            this.showToast('Error', 'All fields are required.', 'error');
            return;
        }

        // Convert to ISO Datetime for Apex
        const start = new Date(this.startDate).toISOString();
        const endtime = new Date(this.endDate).toISOString();

        createRescheduledAppointment({
            start: start,
            endtime: endtime,                  // FIXED PARAM NAME
            reason: this.reason,
            workOrderId: this.rescheduleWorkOrderId,     // FIXED - MUST SEND
            appointmentId: this.rescheduleAppointmentId  // FIXED PARAM NAME
        })
        .then(() => {
            this.showToast('Success', 'Appointment rescheduled.', 'success');
            this.closeRescheduleModal();
        })
        .catch(error => {
            this.showToast('Error', error.body.message, 'error');
        });
    }


    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }

    resetRescheduleFields() {
        this.startDate = '';
        this.endDate = '';
        this.reason = '';
    }
}
