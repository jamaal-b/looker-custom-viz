looker.plugins.visualizations.add({
  id: "multiple_values_pro",
  label: "Multiple Values Pro",
  
  options: {},

  // --- 1. CREATE STAGE ---
  create: function(element, config) {
    element.innerHTML = `
      <style>
        #vis-container {
          display: flex;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          font-family: 'Open Sans', Roboto, sans-serif;
          overflow: auto;
        }
        .metric-block {
          display: flex;
          flex-direction: column;
          flex: 1; /* Shares space equally in horizontal mode */
          box-sizing: border-box;
          justify-content: center;
        }
        .metric-title {
          font-weight: 400;
          opacity: 0.8;
        }
        .metric-value {
          font-weight: 300;
        }
        .progress-bg {
          width: 100%;
          position: relative;
        }
        .progress-bar {
          height: 100%;
          transition: width 0.3s ease;
        }
        .progress-text {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          font-size: 12px;
          text-align: center;
        }
      </style>
      <div id="vis-container"></div>
    `;
  },

  // --- 2. UPDATE STAGE ---
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    const measures = queryResponse.fields.measure_like;
    if (measures.length === 0) {
      this.addError({title: "No Data", message: "This chart requires measures."});
      return;
    }

    const row = data[0];
    let dynamicOptions = {};

    // --- GLOBAL SETTINGS ---
    dynamicOptions["globalFontSize"] = { section: "Global Settings", type: "number", label: "Font Size (Main Number)", default: 42 };
    dynamicOptions["globalOrientation"] = { section: "Global Settings", type: "string", display: "select", label: "Orientation", values: [{"Horizontal": "row"}, {"Vertical": "column"}], default: "column" };
    dynamicOptions["globalDividers"] = { section: "Global Settings", type: "boolean", label: "Dividers between values?", default: false };
    dynamicOptions["globalGap"] = { section: "Global Settings", type: "number", label: "Spacing Between Metrics (px)", default: 40 };
    dynamicOptions["globalBarHeight"] = { section: "Global Settings", type: "number", label: "Progress Bar Height (px)", default: 32 };
    dynamicOptions["globalAlign"] = { section: "Global Settings", type: "string", display: "select", label: "Text Alignment", values: [{"Center": "center"}, {"Left": "left"}, {"Right": "right"}], default: "center" };

    // --- PER-METRIC SETTINGS ---
    for (let i = 0; i < measures.length; i += 2) {
      const actualField = measures[i];
      const fieldName = actualField.name;
      const menuSection = actualField.label_short || actualField.label; 

      dynamicOptions[`showTitle_${fieldName}`] = { section: menuSection, type: "boolean", label: "Show Title", default: true };
      dynamicOptions[`customTitle_${fieldName}`] = { section: menuSection, type: "string", label: "Title", default: menuSection };
      dynamicOptions[`titlePlacement_${fieldName}`] = { section: menuSection, type: "string", display: "select", label: "Title Placement", values: [{"Above number": "above"}, {"Below number": "below"}], default: "above" };
      dynamicOptions[`valueFormat_${fieldName}`] = { section: menuSection, type: "string", label: "Value Format (e.g. $#,##0)", default: "" };
      dynamicOptions[`color_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Color", default: "#333333" };
      
      // Progress Bar Logic
      dynamicOptions[`useConditional_${fieldName}`] = { section: menuSection, type: "boolean", label: "Use Conditional Bar Color", default: false };
      dynamicOptions[`targetThreshold_${fieldName}`] = { section: menuSection, type: "number", label: "Success Threshold (%)", default: 100 };
      dynamicOptions[`successColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Target Met Color", default: "#34A853" };
      dynamicOptions[`dangerColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Target Missed Color", default: "#EA4335" };
      dynamicOptions[`defaultBarColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Standard Bar Color", default: "#9AA0A6" };
      dynamicOptions[`targetBarColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Target Background Color", default: "#E8EAED" };
    }

    this.trigger('registerOptions', dynamicOptions);

    // --- HELPER: BASIC NUMBER FORMATTER ---
    // Looker doesn't cleanly expose its internal format engine to custom JS, so this handles basic currency/commas
    function formatValue(value, formatString, lookerRendered) {
      if (!formatString) return lookerRendered || value; 
      try {
        let isCurrency = formatString.includes('$');
        let decimals = formatString.includes('.') ? formatString.split('.')[1].replace(/[^0-9#]/g, '').length : 0;
        let opts = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
        if (isCurrency) { opts.style = 'currency'; opts.currency = 'USD'; }
        return new Intl.NumberFormat('en-US', opts).format(value);
      } catch (e) { return lookerRendered || value; }
    }


    // --- RENDER HTML ---
    const orientation = config.globalOrientation || "column";
    const gap = config.globalGap !== undefined ? config.globalGap : 40;
    const barHeight = config.globalBarHeight !== undefined ? config.globalBarHeight : 32;
    const showDividers = config.globalDividers;
    
    let html = ``;

    for (let i = 0; i < measures.length; i += 2) {
      const actualField = measures[i];
      const targetField = measures[i + 1];
      const fieldName = actualField.name;

      // Pull configs
      const showTitle = config[`showTitle_${fieldName}`] !== false; // defaults true
      const customTitle = config[`customTitle_${fieldName
