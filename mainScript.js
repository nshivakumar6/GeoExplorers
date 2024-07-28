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
    "esri/WebMap",
    "esri/rest/networkService",
    "esri/rest/serviceArea",
    "esri/rest/support/ServiceAreaParameters",
    "esri/rest/support/FeatureSet",
    "esri/Graphic",
    "esri/widgets/ScaleBar",
    "esri/widgets/Locate",
    "esri/rest/query",
    "esri/rest/support/Query"
], function (esriConfig, Map, MapView, FeatureLayer, Editor, Expand, Search, reactiveUtils, AttachmentsContent, TextContent, Legend, clusterLabelCreator, clusterPopupCreator, WebMap, networkService,
    serviceArea,
    ServiceAreaParameters,
    FeatureSet,
    Graphic,
    ScaleBar,
    Locate,
    query,
    Query
) {
    const url = "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World";
    let networkDescription = null;
    console.log("hello world")
    // Function to create rating content
    function ratingContent(feature) {
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
        type: "unique-value",
        field: "category",
        defaultSymbol: { type: "simple-fill" },
        uniqueValueInfos: [{
            value: "Shopping",
            symbol: {
                type: "simple-fill",
                color: "blue"
            }
        }, {
            value: "Hotels",
            symbol: {
                type: "simple-fill",
                color: "green"
            }
        }, {
            value: "Attractions",
            symbol: {
                type: "simple-fill",
                color: "red"
            }
        }, {
            value: "Recreation",
            symbol: {
                type: "simple-fill",
                color: "yellow"
            }
        }],
        visualVariables: [{
            type: "opacity",
            field: "POPULATION",
            normalizationField: "SQ_KM",
            stops: [{ value: 100, opacity: 0.15 },
            { value: 1000, opacity: 0.90 }]
        }]
    };

    myPointsFeatureLayer
        .when()
        .then(generateClusterConfig)
        .then((featureReduction) => {
            myPointsFeatureLayer.featureReduction = featureReduction;
        })
        .catch((error) => {
            console.error(error);
        });

    esriConfig.apiKey = "AAPKfc2bb44eed604a8fb65dfb72c87516b3YdztxXfTJmkRU-XaiQRV8hKNAwckTew2BfIFlC5mXBd-biav5bHtihYv178cmpyr";

    const webmap = new WebMap({
        portalItem: {
            id: "7caa937b7f954575bb046c5ec5cc2a0c"
        }
    });

    const view = new MapView({
        container: "viewDiv",
        map: webmap,
        center: [-117.18267, 34.0589],
        zoom: 13,
        minZoom: 13,
        maxZoom: 13,
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

    const searchWidget = new Search({
        view: view
    });

    const searchExpand = new Expand({
        view: view,
        content: searchWidget,
        expandIconClass: "esri-icon-search",
        expandTooltip: "Search"
    });

    view.ui.add(searchExpand, {
        position: "top-right"
    });

    const addFeatureEditor = new Editor({
        view: view,
        icon: "plus"
    });

    const addFeatureExpand = new Expand({
        view: view,
        content: addFeatureEditor,
        expandTooltip: "Add Feature"
    });

    view.ui.add([addFeatureExpand, searchExpand], {
        position: "top-right",
        index: 0
    });

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

    function editThis() {
        if (!editor.activeWorkflow) {
            view.popup.visible = false;
            editor.startUpdateWorkflowAtFeatureEdit(view.popup.selectedFeature);
            view.ui.add(editor, "top-right");
        }

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

    reactiveUtils.on(
        () => view.popup,
        "trigger-action",
        (event) => {
            if (event.action.id === "edit-this") {
                editThis();
            }
        }
    );

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
        const popupTemplate = await clusterPopupCreator
            .getTemplates({ layer })
            .then((popupTemplateResponse) => popupTemplateResponse.primaryTemplate.value);

        const { labelingInfo, clusterMinSize } = await clusterLabelCreator
            .getLabelSchemes({
                layer,
                view
            })
            .then((labelSchemes) => labelSchemes.primaryScheme);

        return {
            type: "cluster",
            popupTemplate,
            labelingInfo,
            clusterMinSize
        };
    }

 

    //////////////////////////////// Add Service Area Function //////////////////
    const selectContainer = document.createElement("div");
  selectContainer.className = "esri-widget";
  selectContainer.style.background = "#ffffff";
  selectContainer.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.3)";
  selectContainer.style.padding = "10px";

  const selectLocation = document.createElement("select");
  selectLocation.id = "selectLocation";
  selectLocation.className = "esri-select esri-input";
  selectLocation.style.minWidth = "270px";
  selectLocation.style.fontSize = "16px";
  selectLocation.style.marginBottom = "5px";
  selectLocation.innerHTML = `
    <option value="-117.18441956138463, 34.0512632441219">Downtown Redlands</option>
    <option value="currentLocation">Current Location</option>
  `;

  const selectTravelMode = document.createElement("select");
  selectTravelMode.id = "selectTravelMode";
  selectTravelMode.name = "travelMode";
  selectTravelMode.className = "esri-select esri-input";
  selectTravelMode.style.minWidth = "270px";
  selectTravelMode.style.fontSize = "16px";
  selectTravelMode.innerHTML = `
    <option selected value="Driving Time">5, 10, and 20 minute drive times</option>
    <option value="Walking Time">5, 10, and 20 minute walk times</option>
  `;

  const toggleServiceAreaCheckbox = document.createElement("input");
  toggleServiceAreaCheckbox.type = "checkbox";
  toggleServiceAreaCheckbox.id = "toggleServiceArea";
  toggleServiceAreaCheckbox.checked = true;
  const toggleServiceAreaLabel = document.createElement("label");
  toggleServiceAreaLabel.for = "toggleServiceArea";
  toggleServiceAreaLabel.innerText = "Show Service Areas";

  selectContainer.appendChild(selectLocation);
  selectContainer.appendChild(selectTravelMode);
  selectContainer.appendChild(toggleServiceAreaCheckbox);
  selectContainer.appendChild(toggleServiceAreaLabel);

  // Create the Expand widget
  const expandWidget = new Expand({
    view: view,
    content: selectContainer,
    expandIconClass: "esri-icon-filter",
    expandTooltip: "Select Location and Travel Mode"
  });

  view.ui.add(expandWidget, "top-right");

  // Initialize the service area functionality
  Promise.all([view.when(), networkService.fetchServiceDescription(url)]).then(([_view, description]) => {
    networkDescription = description;

    document.getElementById("selectLocation").addEventListener("change", zoomToLocation);
    document.getElementById("selectTravelMode").addEventListener("change", changeTravelMode);
    document.getElementById("toggleServiceArea").addEventListener("change", toggleServiceAreaVisibility);
    createServiceAreas(view.center);
  });

  view.on("click", (event) => {
    createServiceAreas(event.mapPoint);
  });

  async function createServiceAreas(point) {
    const locationGraphic = createLocationGraphic(point);
    const serviceAreaParams = await createServiceAreaParameters(locationGraphic);
    executeServiceAreaTask(serviceAreaParams);
  }

  function createLocationGraphic(point) {
    view.graphics.removeAll();

    const graphic = new Graphic({
      geometry: point,
      symbol: {
        type: "simple-marker",
        color: "white",
        size: 8
      }
    });
    view.graphics.add(graphic);
    return graphic;
  }

  function createServiceAreaParameters(locationGraphic) {
    const value = document.querySelector("select[name='travelMode'] > option:checked").getAttribute("value");
    const travelMode = networkDescription.supportedTravelModes.find(
      (travelMode) => travelMode.name === value
    );

    const facilities = new FeatureSet({
      features: [locationGraphic]
    });

    const serviceAreaParameters = new ServiceAreaParameters({
      facilities,
      defaultBreaks: [5, 10, 20],
      travelMode,
      outSpatialReference: view.spatialReference,
      trimOuterPolygon: true
    });
    return serviceAreaParameters;
  }

  async function executeServiceAreaTask(serviceAreaParameters) {
    const { serviceAreaPolygons } = await serviceArea.solve(url, serviceAreaParameters);
    serviceAreaGraphics = serviceAreaPolygons.features.map((g) => {
      g.symbol = {
        type: "simple-fill",
        color: [225, 150, 0, 0.5],
        outline: {
          color: "white",
          width: 0.5
        }
      };
      return g;
    });
    if (document.getElementById("toggleServiceArea").checked) {
      view.graphics.addMany(serviceAreaGraphics, 0);
    }
  }

  function toggleServiceAreaVisibility() {
    if (document.getElementById("toggleServiceArea").checked) {
      view.graphics.addMany(serviceAreaGraphics, 0);
    } else {
      view.graphics.removeMany(serviceAreaGraphics);
    }
  }

  async function zoomToLocation(event) {
    if (event.target.value === "currentLocation") {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const center = [position.coords.longitude, position.coords.latitude];
          await view.goTo({
            center,
            zoom: 11
          });
          createServiceAreas(view.center);
        });
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    } else {
      const center = event.target.value.split(",").map((value) => Number(value));
      await view.goTo({
        center,
        zoom: 11
      });
      createServiceAreas(view.center);
    }
  }

  function changeTravelMode() {
    createServiceAreas(view.center);
  }

  //////////////////////////////////// add filter function //////////////////
  const filterContainer = document.createElement("div");
  filterContainer.className = "esri-widget";
  filterContainer.style.background = "#ffffff";
  filterContainer.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.3)";
  filterContainer.style.padding = "10px";

  const filterLabel = document.createElement("label");
  filterLabel.for = "filterAttribute";
  filterLabel.innerText = "Filter by Number of Years Worked: ";

  const filterSelect = document.createElement("select");
  filterSelect.id = "filterAttribute";
  filterSelect.className = "esri-select esri-input";
  filterSelect.style.minWidth = "150px";
  filterSelect.style.fontSize = "14px";
  filterSelect.innerHTML = `
    <option value="All">All</option>
    <option value=0>0 to 1 Year</option>
    <option value=1>1 to 2 Years</option>
    <option value=2>2 to 3 years</option>
    <option value=3>3+ years</option>
  `;

  filterContainer.appendChild(filterLabel);
  filterContainer.appendChild(filterSelect);

  // Create the Expand widget
  const filterWidget = new Expand({
    view: view,
    content: filterContainer,
    expandIconClass: "esri-icon-filter",
    expandTooltip: "Filter Attributes"
  });

  view.ui.add(filterWidget, "top-right");

  // Access the feature layer
  view.when(() => {
    const featureLayer = webmap.layers.find(layer => layer.title === "Redlands Places"); // Replace with your layer's title

    if (featureLayer) {
      console.log("Feature Layer found:", featureLayer);

      // Add event listener for filter changes
      document.getElementById("filterAttribute").addEventListener("change", (event) => {
        const selectedValue = event.target.value;
        applyFilter(featureLayer, selectedValue);
      });
    } else {
      console.error("Feature Layer not found");
    }
  });

  function applyFilter(layer, value) {
    if (value === "All") {
      layer.definitionExpression = ""; // Show all features
    } else {
      value = parseInt(value, 10);
      if (value === 3) {
        layer.definitionExpression = `Years_Worked > ${value}`;
      } else {
        const valueHigher = value + 1;
        layer.definitionExpression = `Years_Worked > ${value} AND Years_Worked <= ${valueHigher}`;
      }
    }
  }
});

