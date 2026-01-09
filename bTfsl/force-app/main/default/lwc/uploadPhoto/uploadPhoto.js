import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class UploadPhoto extends LightningElement {
    @api recordId; // Pass Service_Appointment__c record Id

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: `${uploadedFiles.length} photo(s) uploaded successfully.`,
                variant: 'success'
            })
        );
    }
}
