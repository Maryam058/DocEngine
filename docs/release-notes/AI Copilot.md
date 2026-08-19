# indici AI Copilot

## Overview

We are delighted to introduce indici AI Copilot, an AI-powered suite of tools designed to enhance clinical workflows and bring substantial efficiency gains to medical practices.

As the Copilot will be integrated across a swathe of core features within the indici platform, we are gradually rolling it out to allow users time to adapt. This phased approach ensures:

- A smooth transition without disrupting clinical workflows
- Time for users to get accustomed to each new feature
- Minimal support issues before expanding AI capabilities

Your feedback is crucial! We have always taken a collaborative approach in the design and development of indici to ensure that user experience is prioritised, and the roll out of the Copilot is no exception. So get in touch and let us know how you are getting on, so we can continue to improve our offerings with intelligent, efficient, and user-friendly tools.

## Phase 1: AI-Powered Transcription

### AI Transcription Services

As an indici clinical user, you will be able to take full advantage of the Copilot's AI-driven transcription services from the outset. By converting your patient interactions into structured clinical notes within seconds, the Copilot dramatically reduces the amount of time you need to spend documenting your consults.

Clinical note conversion is performed by multiple established AI processors, all of which are continuously enhancing their capabilities. Therefore, we have taken a flexible approach, allowing practices to choose the service that best suits their needs.

At present, we offer practices a choice of the following AI processors:

- ChatGPT 4.1 (hosted on Azure)
- Claude Sonnet 4 (hosted on AWS)
- Heidi

!!! note
    Processors may be added or subtracted as appropriate in future updates.

### indici Transcriber App

To further enhance transcription accuracy, we have also rolled out the indici Transcriber app, which allows clinicians to use their mobile phones as recording devices during consultations. This promotes better audio quality, improving the accuracy of AI-generated transcripts. Over time, we will introduce more features to the app, focusing on continuously improving efficiency and user experience.

### AI Usage, Credits, & Subscription Management

AI services require significant computational resources, measured in credits or tokens, which are consumed based on usage. Most AI platforms use a pay-per-use model, requiring users to either purchase tokens or subscribe to a plan with a defined number of tokens.

However, we have worked to streamline our users' AI experience by including a comprehensive credit and subscription management system within indici. This allows practices to:

- Purchase and allocate AI credits
- Restrict AI model usage per user
- Set minimum credit thresholds and receive automated alerts when credits need to be replenished

Some AI providers may use an annual subscription model instead of tokens. indici supports seamless handling of such subscriptions, with automated notifications and subscription renewals built in.

### How much does it Cost?

To support the integrated usage of external LLMs for generating consult documentation, we have built an AI Credit Manager into indici, where practices can top up their AI Credit and allocate it to their providers as required. Whenever a provider processes a consult using AI, the relevant charge will be deducted from their AI Credit balance. Details on how to manage AI Credit are provided further down in this document.

The cost of processing a consult will vary depending on the length of the consult recording, the template, and the LLM. However, as an approximate guide and based on previous usage, a consult typically costs between $0.20 and $0.40 (NZD).

## Beyond Phase 1

### Upcoming AI-Powered Features in indici

In addition to transcription and note conversion, we will soon be introducing a wide range of practice-boosting AI features, including:

- **AI-assisted clinical letter writing** that integrates timeline notes, medication lists, and other relevant clinical data
- **AI-powered inbox management**, including auto-filing of results, trigger actions for abnormal findings, and streamlined handling of inbox documents
- **Summarization of discharge summaries** to easily extract key data for patient records
- **AI-powered natural language query builder** to replace the existing advanced report builder
- **Photographic analysis** using AI for clinical decision support
- **Voice-enabled commands** for non-clinical tasks, like booking appointments and creating reminders (future updates will include voice-assisted prescribing)
- **OCR for automated filing** of scanned documents
- **AI-enhanced patient timeline search** for rapid access to relevant records
- **AI avatars** for patient-led pre-consult history-taking, presenting structured history summaries to clinicians
- **AI-driven invoice analysis** for error detection and claims management

### AI-Based Prescribing and Medication Reconciliation

- AI-assisted dose titration for more accurate medication prescribing
- Medication reconciliation from multiple sources
- Integration with NZF for drug interaction checks
- Guideline-based prescribing recommendations
- Script line-based prescribing for improved medication management

## Auditing AI-Based Transcriptions

Since AI-powered transcription is a new and evolving technology, we have developed robust auditing features to ensure accuracy and accountability:

- Comprehensive logging of all AI activities
- Access to raw, processed, and edited transcripts
- Detailed audit trails to assess AI performance over time

!!! note
    This feature is currently available to selected users. If you are interested, please contact your indici representative. It will be rolled out to the wider user base in future updates.

## Copilot User Guide

The following sections describe how to configure and use AI Transcription within indici.

### Configuration

#### Enabling indici AI Copilot

To enable indici AI Copilot for your practice:

1. Go to **Configurations > AI Configuration > AI Credit Allocation**
2. Click the **AI Configurations** tab

    ![AI Configurations tab showing the Enable AI Copilot and Enable AI Transcription Data Retention checkboxes](../assets/AI%20Copilot/image-02.png)

3. Mark the **Enable AI Copilot** checkbox

    ![Enable AI Copilot checkbox marked on the AI Configurations tab](../assets/AI%20Copilot/image-03.png)

4. You can also manage transcript retention from here. This refers to the transcript that is created from your interaction with your patient prior to being sent to an LLM for processing. If you wish the transcript to be kept in the patient's file in indici indefinitely, leave the **Enable AI Transcription Data Retention** checkbox unmarked. However, if you wish to set a definite limit, after which the transcript will be automatically deleted, check this checkbox and then set the limit in hours using the **Retention Period (in Hours)** field

    ![Enable AI Transcription Data Retention checkbox with Retention Period field set to 36 hours](../assets/AI%20Copilot/image-04.png)

5. Once you are happy, click **Save**

#### Requesting AI Credit

As mentioned in the introduction, AI services consume tokens or credits in order to operate.

!!! note
    Your user role or user type must be "Practice Manager" before you can proceed with these steps.

To request credit for your practice:

1. Go to **Configurations > AI Configuration > Cost Allocation**
2. Click the **Request AI Credit for Practice** button in the top right corner

    ![Request AI Credit For Practice button](../assets/AI%20Copilot/image-05.png)

3. In the window that opens, you will see your practice's current credit balance. To request a new amount, simply type that amount into the **Request Amount** field and click **Allocate**

    ![Practice AI Credit Request popup with Request Amount field](../assets/AI%20Copilot/image-06.png)

4. Your request will be sent to the indici team who must approve it before the credit is allocated to your practice. You can view both your pending/unapproved and approved requests from this screen using the search facility at the top

    ![AI Credit Approval Requests For Practice search filters showing Approved and Unapproved options](../assets/AI%20Copilot/image-07.png)

5. Once your request has been approved, your practice's credit balance will be updated accordingly

#### Allocating Credit to Users

When your practice has sufficient AI Copilot credit, the next step is to allocate it to relevant staff members who will then be able to utilise the AI Copilot.

To do this:

1. Go to **Configurations > AI Configuration > AI Credit Allocation**
2. Click the **User AI Credit Allocation** tab

    ![User AI Credit Allocation tab highlighted on the AI Credit Allocation screen](../assets/AI%20Copilot/image-08.png)

3. Click **Allocate AI Credit to User**

    ![Allocate AI Credit To User button](../assets/AI%20Copilot/image-09.png)

4. In the pop up that opens:
    1. Select the user you wish to allocate credit to
    2. Enter the amount in the **AI Credit** field
    3. Mark **Activate**
    4. Select the AI model (or models) you wish to make available to this user

    ![Allocate AI Credit To User popup with user, AI Credit, Activate, and AI Model fields](../assets/AI%20Copilot/image-10.png)

    5. Click **Allocate**, and then click **Yes** in the pop-up to confirm

5. You can edit or delete a user's credit at any time using the respective icons in the **Action** column

    ![Edit and delete icons in the Action column](../assets/AI%20Copilot/image-11.png)

#### Managing Minimum Credit Thresholds

You can set minimum credit amounts for indici AI Copilot at both a practice and provider level. What this means is that if a practice's AI credit falls below the defined minimum amount, then a task can be automatically sent to the practice manager, prompting them to request additional credit.

Likewise, a minimum amount can be set for providers within the practice. If a provider's credit amount falls below the defined minimum, they will be automatically allocated additional credit from the practice's fund.

To set up these configurations:

1. Go to **Configurations > AI Configuration > AI Credit Allocation**
2. Click the **AI Configurations** tab

    ![AI Configurations tab](../assets/AI%20Copilot/image-12.png)

3. At the bottom of the screen, you will see the **Automatic AI Credits** section

    ![Automatic AI Credits section with practice and provider threshold fields](../assets/AI%20Copilot/image-13.png)

##### Managing Minimum Amounts for the Practice

To set a minimum amount for the practice:

1. Enter the value in the **Auto-Request Threshold for AI Credits** field
2. Next, enter the amount the practice should request if they fall below the stated minimum in the **Auto-Request Amount** field
3. Click **Save**

![Auto-Request Threshold for AI Credits and Auto-Request Amount fields highlighted](../assets/AI%20Copilot/image-14.png)

In the example above, if the practice's AI credit falls below 20 credits, a task will be automatically generated for the practice manager, prompting them to request a credit amount of 100 from the indici team. The practice manager will do this by contacting the indici team via email.

##### Managing Minimum Amounts for Providers

To set a minimum amount for providers within the practice:

1. Enter the value in the **Auto-Top-Up Threshold for Provider Credits** field
2. Next, enter the amount the provider should automatically be topped up by if they fall below the stated minimum in the **Auto-Top-Up Amount for Provider Credits** field
3. Click **Save**

![Auto-Top-Up Threshold for Provider Credits and Auto-Top-Up Amount for Provider Credits fields highlighted](../assets/AI%20Copilot/image-15.png)

In the example above, if a provider's AI credit falls below 5 credits, they will automatically receive an additional 50 credits, which will be allocated to them from the practice's AI credit fund.

#### Setting up Custom Templates

You can set up your custom templates, which will be used to instruct the selected AI processor (e.g. ChatGPT) on how to organise your structured notes post-processing.

To create a custom template:

1. Go to **Configurations > AI Configuration > AI Credit Allocation**
2. Click the **AI Custom Template** tab

    ![AI Custom Template tab highlighted on the AI Credit Allocation screen](../assets/AI%20Copilot/image-16.png)

3. In the top right corner, you can choose whether you want to allow your users to use the system-generated template (i.e. the template provided by the indici team), custom templates, or both

    ![Show Template options: System, Custom, or Both](../assets/AI%20Copilot/image-17.png)

4. Click the **Plus** icon to add a custom template

    ![Plus icon next to the Show Template options](../assets/AI%20Copilot/image-18.png)

5. In the window that opens:
    1. Enter the title of the template in the **Title** field
    2. In the **Template** field, enter the prompt for the AI processor on how you want your notes to be presented. In other words, you are instructing the AI on how to organise the consultation information
    3. In the **Description** field, you can type a description of the template for information purposes
    4. Mark the **Active** checkbox to make the template available
    5. If you wish this template to be the default (i.e. when the provider opens the AI Transcribe section, this will be the template that is pre-selected), mark the **Default** checkbox
    6. Click **Save**

    ![AI Custom Template popup with Title, Template, Description, Active, and Default fields](../assets/AI%20Copilot/image-19.png)

6. All saved templates will appear in the grid below. You can edit or delete custom templates by clicking on the respective icons in the **Action** column.

    !!! note
        You cannot delete system templates.

    ![Edit and delete icons in the Action column](../assets/AI%20Copilot/image-20.png)

Once templates are made available, users will be able to select them from the **Template** field in the AI Transcribe section within the patient's Consult File.

![AI Transcribe panel Template dropdown showing system and custom templates available for selection](../assets/AI%20Copilot/image-21.png)

### Managing Access

#### Enabling Users to Access the Copilot

To ensure a user has access to indici AI Copilot:

1. Go to **Configurations > AI Configuration > AI User Configuration**
2. Search for the user in question using the **Search by Name** field
3. Ensure the **Manage AI Access** checkbox is marked

![AI User Access Rights search with Manage Access checkbox highlighted](../assets/AI%20Copilot/image-22.png)

#### Access Permissions

A number of access permissions have been added to the indici Access Permissions Matrix. To open this matrix, go to **Configurations > User Management > Access Rights**. Here you will see the following new permissions.

##### AI Configuration

Under **Configurations**, expand **AI Configuration**. This allows you to control which user roles have access to:

- AI Credit Allocation screen
- AI User Configuration screen

Simply mark the checkboxes under the user roles you want to have access and click **Save**.

![Access Permissions Matrix with the AI Configuration section, AI Credit Allocation, and AI User Configuration rows highlighted](../assets/AI%20Copilot/image-23.png)

##### AI Activities

Expand **Patient Note Functions** to see **AI Activities**. This controls who can access the AI Activities section within the Patient Note Functions on the Consult Screen.

Simply mark the checkboxes under the user roles you want to have access to and click **Save**.

![Access Permissions Matrix with the AI Activities row highlighted under Patient Note Functions](../assets/AI%20Copilot/image-24.png)

##### AI Balance Usage Report

Expand the **Report** section to see the **AI Balance Usage Report**. This controls who can access the AI Balance Usage Report in order to view AI credit usage details.

Simply mark the checkboxes under the user roles you want to have access to and click **Save**.

![Access Permissions Matrix with the AI Balance Usage Report row highlighted under Report](../assets/AI%20Copilot/image-25.png)

### Using indici AI Copilot

If you have been given access to indici AI Copilot by your practice and allocated sufficient AI credit, you can use indici AI Copilot to assist in documenting your patient consults. Depending on how your practice has set up the Copilot, you may have the choice of using one or multiple AI processors.

#### Using Azure OpenAI, or Claude Sonnet

When using Azure OpenAI or Claude Sonnet, please follow the steps below.

##### Documenting your Consult

To document your consult:

1. Begin the consult as you normally would
2. In the right-hand section of the patient's Consult File, click the **AI Transcribe** tab
3. Here you will see your remaining AI Credit

    ![AI Transcribe tab showing the AI model, notes template, consent checkbox, and remaining Provider Credit](../assets/AI%20Copilot/image-26.png)

4. You can select the AI model you wish to use (this list will depend on which models your practice has made available), as well as the Notes Template you wish the notes to be processed into (e.g. SOAP)
5. To set your preferred model and template, click the respective stars so that they turn yellow. Once the AI finishes processing the content, these will be considered your preferred options and preselected for future processes

    ![Model and Template dropdowns with the preference star icons](../assets/AI%20Copilot/image-27.png)

6. You also need to mark that the patient has consented to the use of AI during their consultation

    ![I have obtained patient consent to utilize AI checkbox marked](../assets/AI%20Copilot/image-28.png)

7. Click **Start** and confirm that you wish to allow the application to access your device's microphone

    !!! note
        To use this, you must have a microphone either built into your computer/phone or plugged in externally.

    ![Start button on the AI Transcribe panel](../assets/AI%20Copilot/image-29.png)

8. Carry out your consultation with your patient, and the transcript will appear in real time. When you are finished, click **Stop**

    ![Stop button on the AI Transcribe panel](../assets/AI%20Copilot/image-30.png)

9. The AI model you selected will automatically begin to process the text and convert it into structured consult notes

    ![Processing indicator while notes are generated by the indici AI Copilot](../assets/AI%20Copilot/image-31.png)

10. When the AI has finished processing the content, you will see that content displayed in the same panel, but now it will be organised into the selected Notes template (e.g. SOAP) as well as Medications, Diagnoses, Referrals, etc, if applicable

    ![AI Processed Notes panel showing structured clinical notes generated from the consult](../assets/AI%20Copilot/image-32.png)

11. The information generated by AI Copilot now needs to be approved before it can be saved within the patient's record

##### Approving AI-Processed Content

AI-processed content must be approved as follows:

1. **Consult Notes:** Review the consult notes and ensure you are happy with them. You can manually update them if you wish. Once you are happy, click this icon to save the notes into the patient's record

    ![AI Processed Notes panel with the save icon highlighted](../assets/AI%20Copilot/image-34.png)

    You can also view the Original Transcript and AI-processed notes side by side, by clicking this icon.

    ![Consult Notes panel with the Input/Output toggle icon highlighted, showing the transcript alongside the AI-processed notes](../assets/AI%20Copilot/image-33.png)

    The Original Transcript will appear on the left under Input, while the AI-processed notes will appear on the right under Output:

    ![AI activity detail view showing the original transcript Input alongside the AI Processed Output](../assets/AI%20Copilot/image-35.png)

2. **Medications:** The Copilot will present suggested medications within the Medications tab based on your discussion with the patient. If you wish to generate scripts for any of these (and save the medications into the patient's record), click the magnifying glass icon next to them

    ![AI Processed Medication(s) list with the magnifying glass search icon highlighted](../assets/AI%20Copilot/image-36.png)

    This will open the Medication Advanced Search window, where you can select the specific medication you require and finalise the prescription. For any medication that you have actioned (i.e. by generating a script), the bullet point next to it will turn to a green tick to show that it has been added to the patient's record.

    ![AI Processed Medication(s) list with Metformin marked with a green tick after being actioned](../assets/AI%20Copilot/image-37.png)

3. **Diagnoses, Allergies, Referrals, etc:** Other categorised information recorded during the consult can be actioned in the same way as medications. For example, for any diagnoses suggested, if you click the magnifying glass icon next to them, the system will take you straight to the SNOMED Diagnosis selection window, where you can record the diagnosis within the patient's record. Likewise, for allergies, referrals, recalls, tasks, etc.

##### Documenting an ACC Consult

If your interaction with the patient includes information related to an accident, the AI Copilot will automatically process the transcript in the context of an ACC Consult.

Once you click AI-Process, the notes returned by the Copilot will include an accident details section. You can use these notes to automatically populate an ACC45 form by clicking the plus icon next to them.

![AI Processed ACC section with accident details and the plus icon highlighted](../assets/AI%20Copilot/image-38.png)

A pop up will appear reminding you to review the form to ensure its accuracy before submitting. Click **OK** to continue.

![Warning popup stating the Accident Details section of the ACC45 form is auto-populated using AI processing](../assets/AI%20Copilot/image-39.png)

This will open the ACC45 form, where certain fields will be automatically filled in based on your interaction with the patient. Review the form, edit or add to it as required, and then submit as you normally would.

![ACC45 Accident Detail form with fields pre-populated from the AI-processed consult](../assets/AI%20Copilot/image-40.png)

##### AI Activities

Once you have actioned/approved all of the AI-processed content you wish to include within the patient's record, you can simply leave any unnecessary remaining information as it is. Any information that has not been actioned won't be saved within the record.

You can always view your AI activities, including the original raw transcription content from the recording, by clicking **AI Activities** in the Patient Note Functions list.

![AI Activities item in the Patient Note Functions list](../assets/AI%20Copilot/image-41.png)

In the section that opens, click the eye icon next to an activity to view it in more detail.

![AI activities grid with the eye icon highlighted in the Action column](../assets/AI%20Copilot/image-42.png)

!!! note
    Depending on how you have set up your configurations, the original transcript may only be retained for a temporary period. You can find more details on this in the [Enabling indici AI Copilot](#enabling-indici-ai-copilot) section of this guide.

#### Using Heidi

Most of the AI processors integrate seamlessly into indici, but some, like Heidi, require an external widget to function alongside the system. Therefore, if you are using Heidi, the workflow is slightly different. Simply follow the steps below:

1. In the Notes section of the patient's Consult File, click the **Heidi** icon

    ![Heidi icon in the Notes panel toolbar](../assets/AI%20Copilot/image-43.png)

2. A pop-up will ask you to allow access to your microphone. If you want to be able to transcribe the consult, click **Allow**
3. If the microphone icon is red, you should click to enable it. Once it is enabled, it will turn green

    ![Heidi widget microphone icon](../assets/AI%20Copilot/image-44.png)

4. When you're ready to start the session with your patient, click **Start Visit**

    ![Heidi widget with the Start Visit button highlighted](../assets/AI%20Copilot/image-45.png)

5. The system will create a transcription of your interaction with your patient. Once the visit is complete, hover the cursor over the timer

    ![Heidi widget showing the active recording timer](../assets/AI%20Copilot/image-46.png)

6. The button will display **End Session**. Click it to stop the recording

    ![End session button](../assets/AI%20Copilot/image-47.png)

    !!! note
        If you wish to resume the recording, simply click Resume.

7. Once you have stopped the recording, select your desired template, e.g. SOAP

    ![Heidi widget note template list showing H&P, H&P (Issues), and SOAP options](../assets/AI%20Copilot/image-48.png)

8. The Copilot will use the selected template to generate notes from your transcript, which you will see in the panel

    ![Heidi widget displaying generated SOAP notes for the consult](../assets/AI%20Copilot/image-49.png)

9. You can also specify the level of detail and layout of your notes by clicking the dropdown menu next to the Template field, selecting the appropriate options, and clicking **Apply**

    ![Heidi widget with the Goldilocks style dropdown highlighted next to the Template field](../assets/AI%20Copilot/image-50.png)

    ![Customise style panel with Scribe, Voice, and Level of detail options](../assets/AI%20Copilot/image-51.png)

10. You can manually type in some context for the session via the **Context** tab

    ![Heidi widget with the Context tab highlighted](../assets/AI%20Copilot/image-52.png)

11. And you can view the unprocessed transcript of the patient session by clicking **Transcript**
12. Click **Note** to return to the processed notes
13. Once you have reviewed the notes and are happy, click **Push Note** to push these notes to the patient's file in indici

If you want to start a new session within Heidi at any point, click the three dots icon and select **New Session**.

![Heidi widget menu showing Switch to dark mode, New session, and Heidi Help options](../assets/AI%20Copilot/image-53.png)

!!! note
    Heidi will only be enabled for indici AI Copilot users.

### indici AI Transcriber App

#### Overview

Alongside our indici AI Copilot, we have designed and developed the indici Transcriber app to further enhance the speed and accuracy of documenting a consultation. The indici Transcriber app allows providers to use their phone to record the interaction with their patient and then seamlessly syncs the transcribed data back to indici.

Often, your phone will have higher levels of audio quality than the microphone built into your computer, meaning it is much better suited to generating accurate consult transcripts. This, in turn, supports more efficient outputs when you use AI to process the consult, essentially optimising the speed and efficiency of your entire consult documentation workflow.

Building on previous versions of the Transcriber app, we have pared down the process to achieve a truly streamlined user experience. All you have to do is:

1. Generate a QR Code within the patient's file in indici
2. Scan the QR Code using the indici AI Transcriber app on your mobile device
3. The app will open and automatically start recording the consultation

Once the consult is complete, the app automatically syncs the transcribed data back to the patient's file in indici, where it can be processed through your selected AI model to produce full, structured consultation notes.

#### How to use the indici Transcriber App

##### Downloading the App

To download the indici Transcriber app:

1. Open the relevant app store on your phone (Apple App Store for iPhone users; Google Play Store for Android users) and search for "indici Transcriber app"
2. Once you have found the app, click **Install**

##### Generating a QR Code

The next step is to generate a QR Code for the patient you are seeing. To do so:

1. Open the patient's file as normal
2. Click the **Generate QR Code** icon in the top banner

    ![Patient banner with the Generate QR Code icon highlighted](../assets/AI%20Copilot/image-54.png)

3. The QR Code will be displayed in a pop-up for you to scan using the Transcriber App on your mobile device

    ![Provider Photo Application QR code popup](../assets/AI%20Copilot/image-55.png)

##### Scanning the QR Code

1. Open the indici AI Transcriber app on your mobile device
2. The app's QR code scanning feature will automatically open. Use it to scan the QR code displayed in the relevant patient's file

    ![indici AI Copilot mobile app scanning the QR code displayed on screen](../assets/AI%20Copilot/image-56.png)

3. Once the QR code has been successfully scanned, the app will automatically start recording the consult. Details for the relevant patient will be displayed at the top of the mobile screen
4. Please note, when launching the app for the first time, you may need to allow the app to send you notifications and record audio

##### Recording the Consult

As soon as you have scanned the QR code, the app will start recording the consultation automatically. You will see the timer has been activated, and a message in red font will advise you that the recording is in progress.

![indici AI Transcriber app showing patient details and the consultation recording in progress](../assets/AI%20Copilot/image-57.png)

You should place the phone somewhere close by and unobstructed to get the highest possible audio quality and reduce the potential for errors in the transcript.

Then simply carry out your consultation with your patient. If you wish to pause the recording at any point, click **Pause**. The app will not record any audio while paused.

![Consultation Recording screen with the Pause button highlighted](../assets/AI%20Copilot/image-58.png)

Once you are finished, click **End Consultation**.

![Consultation Recording screen with the End Consultation button highlighted](../assets/AI%20Copilot/image-59.png)

##### Syncing the Transcript back to indici

As soon as you click **End Consultation**, you will see a message advising you that the audio is now processing.

![Consultation Recording screen showing audio processing progress](../assets/AI%20Copilot/image-60.png)

Once the processing has been completed, the app will automatically send the generated transcript to the patient's file in indici. You will see a message advising you that it has been sent.

![Transcript sent successfully confirmation popup](../assets/AI%20Copilot/image-61.png)

To view the transcript, open the patient's indici file and navigate to the AI Transcribe section (in the right-hand panel).

![AI Transcribe panel showing the synced transcript ready for AI processing](../assets/AI%20Copilot/image-62.png)

You can then process this data using a selected AI processor model as described in the previous section ([Using indici AI Copilot](#using-indici-ai-copilot)).

## AI Balance Report

We have added a new report in indici called AI Balance Report, where you can view how much AI credit has been consumed and by whom.

To open this report:

1. Go to **Reports > AI Balance Report**

    ![Reports menu with AI Balance Report highlighted](../assets/AI%20Copilot/image-63.png)

2. You can opt to view results by user or by location. Simply select the appropriate filter in the top left corner, and the results will be filtered accordingly

    ![AI Credit Usage Report with User Level and Location Level filter options](../assets/AI%20Copilot/image-64.png)

3. You can also filter the report by Username, Patient Name, NHI, Type, and Date Range

    ![AI Credit Usage Report filter panel with Username, Patient Name, NHI, Type, and Date Range fields](../assets/AI%20Copilot/image-65.png)

4. Once you click **Search**, the results will be returned, displaying how much credit has been used within the defined date range per location or per user (depending on which filter you selected)

    ![AI Credit Usage Report results grid showing usage by date, type, user, model, template, and cost](../assets/AI%20Copilot/image-66.png)

5. You can view the content of what was processed by the AI by clicking the eye icon in the **Actions** column next to any of the results

    ![Eye icon in the Actions column](../assets/AI%20Copilot/image-67.png)
