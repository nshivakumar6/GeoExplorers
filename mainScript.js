require([
        "esri/config",
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/widgets/Editor",
        "esri/widgets/Expand",
        "esri/widgets/Search",
        "esri/core/reactiveUtils",
        "esri/popup/content/AttachmentsContent",
        "esri/popup/content/TextContent"
        ], function(esriConfig, Map, MapView, FeatureLayer, Editor, Expand, Search, reactiveUtils, AttachmentsContent, TextContent) {

        // Function to create rating content
        function ratingContent(feature) {
        // Set how the attachments should display within the popup
        const attachmentsElement = new AttachmentsContent({
        displayType: "list"
        });

        const textElement = new TextContent();

        const rating = feature.graphic.attributes.Rating;
        let color;
        if (rating >= 4) {
        color = "green";
        } else if (rating >= 2) {
        color = "purple";
        } else {
        color = "red";
        }

        textElement.text = `The rating for this feature is <b><span style='color:${color}'>${rating}</span>/5.`;

        return [textElement, attachmentsElement];
        }

        // Reference a feature layer to edit
        const myPointsFeatureLayer = new FeatureLayer({
        url: "https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/arcgis/rest/services/AddTableRelation/FeatureServer",
        outFields: ["*"], // Ensure all fields are available for editing
        popupTemplate: {
        title: "Location: {place_name}",
        content: ratingContent,
        fieldInfos: [
        { fieldName: "rating", label: "Rating" }
        ],
        actions: [{
        title: "Edit",
        id: "edit-this",
        className: "esri-icon-edit"
        }]
        }
        });

        esriConfig.apiKey = "AAPKfc2bb44eed604a8fb65dfb72c87516b3YdztxXfTJmkRU-XaiQRV8hKNAwckTew2BfIFlC5mXBd-biav5bHtihYv178cmpyr";

        const map = new Map({
        basemap: "arcgis/topographic", // basemap styles service
        layers: [myPointsFeatureLayer]
        });

        const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-117.18267, 34.0589],
        zoom: 13
        });

        // Add the title to the view

        // Search widget
        const searchWidget = new Search({
        view: view
        });

        // Add the Search widget to an Expand widget
        const searchExpand = new Expand({
        view: view,
        content: searchWidget,
        expandIconClass: "esri-icon-search", // Optional, adds a search icon to the Expand widget
        expandTooltip: "Search"
        });

        // Add the Search Expand widget to the top right corner of the view
        view.ui.add(searchExpand, {
        position: "top-right"
        });

        // Editor widget for adding new features
        const addFeatureEditor = new Editor({
        view: view,
        icon: "plus"
        });

        // Add the Editor widget to an Expand widget with a plus icon
        const addFeatureExpand = new Expand({
        view: view,
        content: addFeatureEditor,
        expandIconClass: "esri-icon-plus", // Adds a plus icon to the Expand widget
        expandTooltip: "Add Feature"
        });

        // Add the Expand widgets to the top right corner of the view, stacked
        view.ui.add([addFeatureExpand, searchExpand], {
        position: "top-right",
        index: 0 // Ensures they are stacked in the order they are added
        });

        // Create the Editor with the specified layer and a list of field configurations
        const editor = new Editor({
        view: view,
        layerInfos: [{
        layer: myPointsFeatureLayer,
        formTemplate: {
        elements: [
        { type: "field", fieldName: "place_name", label: "Place Name" },
        { type: "field", fieldName: "rating", label: "Rating" }
        ]
        }
        }]
        });

        // Function to handle the "Edit feature" action
        function editThis() {
        if (!editor.activeWorkflow) {
        view.popup.visible = false;
        editor.startUpdateWorkflowAtFeatureEdit(view.popup.selectedFeature);
        view.ui.add(editor, "top-right");
        }

        // Remove the editor widget from the display when the state of the editor's viewModel is "ready" and re-add the popup
        reactiveUtils.when(
        () => editor.viewModel.state === "ready",
        () => {
        view.ui.remove(editor);
        view.openPopup({
        fetchFeatures: true,
        shouldFocus: true
        });
        }
        );
        }

        // Event handler that fires each time an action is clicked
        reactiveUtils.on(
        () => view.popup,
        "trigger-action",
        (event) => {
        if (event.action.id === "edit-this") {
        editThis();
        }
        }
        );

        // Watch when the popup is visible
        reactiveUtils.watch(
        () => view.popup?.visible,
        (event) => {
        if (editor.viewModel.state === "editing-existing-feature") {
        view.closePopup();
        } else {
        features = view.popup.features;
        }
        }
        );

        myPointsFeatureLayer.on("apply-edits", () => {
        view.ui.remove(editor);
        features.forEach((feature) => {
        feature.popupTemplate = myPointsFeatureLayer.popupTemplate;
        });
        if (features) {
        view.openPopup({
        features: features
        });
        }
        editor.viewModel.cancelWorkflow();
        });

        // Create a div for filtering by amenity category
        const filterDiv = document.createElement("div");
        filterDiv.id = "amenity-filter";
        filterDiv.className = "esri-widget";
        filterDiv.innerHTML = `
        <div class="filter-item" data-category="">All</div>
        <div class="filter-item" data-category="Park">Park</div>
        <div class="filter-item" data-category="School">School</div>
        <div class="filter-item" data-category="Hospital">Hospital</div>
        <!-- Add more categories as needed -->
        `;
        filterDiv.style.padding = "10px";

        // Add the Filter div to an Expand widget
        const filterExpand = new Expand({
        view: view,
        content: filterDiv,
        expandIconClass: "esri-icon-filter", // Adds a filter icon to the Expand widget
        expandTooltip: "Filter Features"
        });

        // Add the Filter Expand widget to the top right corner of the view
        view.ui.add(filterExpand, {
        position: "top-right"
        });

        // Handle filter change
        document.getElementById("amenity-filter").addEventListener("click", (event) => {
        const selectedCategory = event.target.getAttribute("data-category");
        if (selectedCategory) {
        myPointsFeatureLayer.definitionExpression = selectedCategory ? `amenity_category = '${selectedCategory}'` : "";
        }
        });

        // Clear the filter when the Expand widget is collapsed
        reactiveUtils.when(
        () => !filterExpand.expanded,
        () => {
        myPointsFeatureLayer.definitionExpression = "";
        }
        );
        });