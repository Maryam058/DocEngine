# Medical Warnings

## Introduction

Our latest release introduces an important new feature that allows users to seamlessly pull patient medical warning records from Health NZ into the indici system. The retrieved medical warnings will be displayed under the "Allergies/Medical Warnings" section of the relevant patient's consult screen in indici.

Requests to fetch the warnings are generated within indici using the **Get NMWS Warnings** button, which triggers a backend script to display the data.

We have also provided useful filtering capabilities so users can search for medical warnings based on specific criteria such as date and status.

## Configurations to Access Medical Warnings

To enable a user to access indici Medical Warnings, the user's role access rights must be configured at the practice level. The following steps need to be followed to display the Medical Warnings tab on the *Patient Consult* screen:

1. Log in to indici

    ![indici login screen](../assets/Medical_Warnings/indici-login-screen.png)

2. Go to Configurations > User Management > Access Rights
3. Here you will see the **Medical Warning** permission. This allows you to control which user roles have access to.
4. Mark the checkboxes under the user roles you want to have access to and click Save:

    ![Access Rights screen with the Medical Warnings permission row highlighted](../assets/Medical_Warnings/access-rights-medical-warning-permission.png)

## Medical Warnings Workflow

The below steps illustrate the complete flow of how medical warnings are displayed indici:

1. Go to *Patients > Search & List*:

    ![Patients menu with Search & List highlighted](../assets/Medical_Warnings/patients-search-and-list-menu.png)

2. On the *Search & List* screen, click the name of the relevant patient to open their *Consult* screen.
3. In the left pane click the **Allergies/Medical Warnings** option:

    ![Patient Note Functions pane with Allergies/Medical Warning highlighted, showing the empty Allergies/Adverse reactions tab](../assets/Medical_Warnings/allergies-medical-warning-panel.png)

4. Click the *Medical Warnings* tab:

    ![Empty Medical Warnings tab](../assets/Medical_Warnings/medical-warnings-tab-empty.png)

5. To fetch medical warnings from Health NZ, click the **Get NMWS Warnings** button. A script is executed in the backend, ensuring that the most up-to-date medical warnings from Health NZ are retrieved and displayed accurately:

    ![Medical Warnings tab with the Get NMWS Warnings button highlighted](../assets/Medical_Warnings/get-nmws-warnings-button.png)

6. The medical warnings retrieved from Health NZ will be displayed as highlighted in the below image:

    ![Medical Warnings tab showing retrieved warning records](../assets/Medical_Warnings/medical-warnings-results-table.png)

7. The users can filter medical warning records by Date and Status to search and view relevant records:

    - **Date Filter**: Allows users to specify a date range or select specific dates when searching for medical warnings.
    - **Status Filter**: Enables users to filter warnings by their current status (e.g. Active, Inactive):

    ![Medical Warnings tab with Date and Status filter fields highlighted](../assets/Medical_Warnings/date-status-filter.png)
