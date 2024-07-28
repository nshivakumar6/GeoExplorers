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
  "esri/popup/content/TextContent",
  "esri/widgets/Legend",
  "esri/smartMapping/labels/clusters",
  "esri/smartMapping/popup/clusters",
  "esri/WebMap"

], function(esriConfig, Map, MapView, FeatureLayer, Editor, Expand, Search, reactiveUtils, AttachmentsContent, TextContent, Legend, clusterLabelCreator, clusterPopupCreator, WebMap) {

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
    const review = feature.graphic.attributes.Reviews;
    const reviewer = feature.graphic.attributes.Creator;
    textElement.text = `
      <div >
          <p style="margin: 0;">
            The rating for this feature is 
            <b><span style="color:${color}; font-size: 1.4em;">${rating}</span></b>/5.
          </p>
          <p style="margin: 0;">
            <b>Reviewers:</b> ${reviewer}
          </p>
          <p style="margin: 0;">
            <b>Reviews:</b> ${review}
          </p>
        </div>
    `;


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
      
    }
  });
  
  myPointsFeatureLayer.renderer = {
  type: "unique-value",  // autocasts as new UniqueValueRenderer()
  field: "category",
  defaultSymbol: { type: "simple-fill" },  // autocasts as new SimpleFillSymbol()
  uniqueValueInfos: [{
    // All features with value of "North" will be blue
    value: "Shopping",
    symbol: {
      type: "simple-fill",  // autocasts as new SimpleFillSymbol()
      color: "blue"
    }
  }, {
    // All features with value of "East" will be green
    value: "Hotels",
    symbol: {
      type: "simple-fill",  // autocasts as new SimpleFillSymbol()
      color: "green"
    }
  }, {
    // All features with value of "South" will be red
    value: "Attractions",
    symbol: {
      type: "simple-fill",  // autocasts as new SimpleFillSymbol()
      color: "red"
    }
  }, {
    // All features with value of "West" will be yellow
    value: "Recreation",
    symbol: {
      type: "simple-fill",  // autocasts as new SimpleFillSymbol()
      color: "yellow"
    }
  }],
  visualVariables: [{
    type: "opacity",
    field: "POPULATION",
    normalizationField: "SQ_KM",
    // features with 30 ppl/sq km or below are assigned the first opacity value
    stops: [{ value: 100, opacity: 0.15 },
            { value: 1000, opacity: 0.90 }]
    }]
  };

  myPointsFeatureLayer
    .when()
    .then(generateClusterConfig)
    .then((featureReduction) => {
      // sets generated cluster configuration on the layer
      myPointsFeatureLayer.featureReduction = featureReduction;
    })
    .catch((error) => {
      console.error(error);
    });

  esriConfig.apiKey = "AAPKfc2bb44eed604a8fb65dfb72c87516b3YdztxXfTJmkRU-XaiQRV8hKNAwckTew2BfIFlC5mXBd-biav5bHtihYv178cmpyr";

  const webmap = new WebMap({
  portalItem: { // autocasts as new PortalItem()
    id: "7caa937b7f954575bb046c5ec5cc2a0c"
     }
  });

  const view = new MapView({
    container: "viewDiv",
    map: webmap,
    center: [-117.18267, 34.0589],
    zoom: 13,
    minZoom: 13, // Lock the zoom level
    maxZoom: 13, // Lock the zoom level
    popup: {
      dockEnabled: false,
      dockOptions: {
        breakpoint: false,
      }
    },
  });

  view.ui.add(
    new Expand({
      content: new Legend({ view }),
      view
    }),
    "top-left"
  );

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

 

  async function generateClusterConfig(layer) {
    // generates default popupTemplate
    const popupTemplate = await clusterPopupCreator
      .getTemplates({ layer })
      .then((popupTemplateResponse) => popupTemplateResponse.primaryTemplate.value);

    // generates default labelingInfo
    const { labelingInfo, clusterMinSize } = await clusterLabelCreator
      .getLabelSchemes({
        layer,
        view
      })
      .then((labelSchemes) => labelSchemes.primaryScheme);

    // Set this object on layer.featureReduction
    return {
      type: "cluster",
      popupTemplate,
      labelingInfo,
      clusterMinSize
    };
  }
});