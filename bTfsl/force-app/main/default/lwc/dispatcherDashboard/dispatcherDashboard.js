import { LightningElement, wire, track } from 'lwc';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import WORK_ORDER_OBJECT from '@salesforce/schema/Work_Order__c';
import STATUS_FIELD from '@salesforce/schema/Work_Order__c.Status__c';
import {refreshApex} from '@salesforce/apex';
import getUnassignedWorkOrders from '@salesforce/apex/DispatcherDashboardController.getUnassignedWorkOrders';
import getAvailableResources from '@salesforce/apex/DispatcherDashboardController.getAvailableResources';
import createServiceAppointment from '@salesforce/apex/DispatcherDashboardController.createServiceAppointment';
import getTodaysServiceAppointmentCount from '@salesforce/apex/DispatcherDashboardController.getTodaysServiceAppointmentCount';
import getWorkOrdersByStartDate from '@salesforce/apex/DispatcherDashboardController.getWorkOrdersByStartDate';

export default class DispatcherDashboard extends LightningElement {
    @track workOrders = [];
    @track filteredWorkOrders = [];
    @track resources = [];
    @track selectedStatus = 'New';
    @track selectedWorkOrder = null;
    @track showModal = false;
    @track isLoading = true;
    @track statusOptions = [];;
    @track todayAppointmentCount = 0;

    @track searchStartDate;
    @track searchEndDate;
    @track searchedWorkOrders = [];



    // Lightning datatable columns
    workOrderColumns = [
        { label: 'Work Order Number', fieldName: 'Name', type: 'text' },
        { label: 'Status', fieldName: 'Status__c' },
        { label: 'Priority', fieldName: 'Priority__c' },
        { label: 'Start Date', fieldName: 'Start_Date__c', type: 'date' },
        { label: 'End Date', fieldName: 'End_Date__c', type: 'date' },
        { label: 'Action', type: 'button', typeAttributes: { label: 'Assign', name: 'assign' },  disabled: { fieldName: 'isAssignDisabled' } }
    ];

    resourceColumns = [
        { label: 'Name', fieldName: 'Name' },
        { label: 'Skill Set', fieldName: 'Resource_Type__c' },
        { label: 'Skill Level', fieldName: 'Skill_Level__c',type :'number' },
        { label: 'Action', type: 'button', typeAttributes: { label: 'Select', name: 'select' } }
    ];

    // Fetch object metadata
    @wire(getObjectInfo, { objectApiName: WORK_ORDER_OBJECT })
    objectInfo;

    // Fetch picklist values for Status field
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })
    wiredStatusValues({ data, error }) {
        if (data) {
            this.statusOptions = [
                { label: 'ALL', value: 'ALL' },
                ...data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }))
            ];
        } else if (error) {
            console.error('Error loading status picklist values', error);
        }
    }

    connectedCallback() {
        this.loadData();
        this.fetchTodayAppointmentCount();
    }

     async fetchTodayAppointmentCount() {
        try {
            const count = await getTodaysServiceAppointmentCount();
            console.log('Appointment count received:', count);
            this.todayAppointmentCount = count;
            refreshApex(this.todayAppointmentCount);
        } catch (error) {
            console.error('Error fetching today\'s appointment count:', error);
        }
    }


    async loadData() {
        this.isLoading = true;
        try {
            this.workOrders = await getUnassignedWorkOrders({ status: this.selectedStatus });
            this.resources = await getAvailableResources();
            
            // Add the disable flag to each work order based on Status__c
            this.workOrders = workOrders.map(wo => ({
                ...wo,
                isAssignDisabled: wo.Status__c !== 'New'
            }));
            refreshApex(this.workOrders);
            this.resources = resources;
             console.log('wo:',this.workOrders);
            console.log('resources:',this.resources);      
            //this.filterWorkOrders();
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            this.isLoading = false;
        }
    }

    handleStatusChange(event) {
        this.selectedStatus = event.detail.value;
        this.loadData();
    }

    // filterWorkOrders() {
    //     if (!this.selectedStatus) {
    //         this.filteredWorkOrders = this.workOrders;
    //     } else {
    //         this.filteredWorkOrders = this.workOrders.filter(
    //             wo => wo.Status === this.selectedStatus
    //         );
    //     }
    // }

    handleWorkOrderAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'assign') {
            // Allow only 'New' status
            if (row.Status__c !== 'New') {
                alert(`Only Work Orders with status "New" can be assigned. Current status: "${row.Status__c}".`);
                return;
            }
            // // Prevent assigning if status is Completed or Cancelled
            // const disallowedStatuses = ['Completed', 'Cancelled']; 

            // if (disallowedStatuses.includes(row.Status__c)) {
            //     alert(`Cannot assign a Work Order with status "${row.Status__c}".`);
            //     return;
            // }
            this.selectedWorkOrder = row;
            this.showModal = true;
        }
    }

    closeModal() {
        this.showModal = false;
        this.selectedWorkOrder = null;
        refreshApex(this.workOrders);
    }

    async handleResourceAction(event) {
        const actionName = event.detail.action.name;
        const resource = event.detail.row;

        if (actionName === 'select') {
            if (this.selectedWorkOrder) {
                try {
                    this.isLoading = true;
                    await createServiceAppointment({
                        workOrderId: this.selectedWorkOrder.Id,
                        resourceId: resource.Id
                    });
                    alert(`Service Appointment created for Work Order ${this.selectedWorkOrder.Name}`);
                    this.closeModal();
                    this.loadData();
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to create Service Appointment');
                } finally {
                    this.isLoading = false;
                }
            }
        }
    }

    handleStartDateChange(event) {
        this.searchStartDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.searchEndDate = event.target.value;
    }

    async handleSearch() {
        if (!this.searchStartDate || !this.searchEndDate) {
            alert('Please select both Start Date and End Date.');
            return;
        }

        try {
            this.isLoading = true;
            const result = await getWorkOrdersByStartDate({
                startDate: this.searchStartDate,
                endDate: this.searchEndDate,
                status: this.selectedStatus
            });

            this.workOrders = result.map(wo => ({
                ...wo,
                isAssignDisabled: wo.Status__c !== 'New'
            }));
        } catch (error) {
            console.error('Error fetching work orders by date range:', error);
            alert('Failed to fetch Work Orders.');
        } finally {
            this.isLoading = false;
        }
    }
}