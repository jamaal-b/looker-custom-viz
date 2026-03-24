looker.plugins.visualizations.add({
  id: "multiple_values_pro",
  label: "Multiple Values Pro",
  
  options: {},

  // --- 1. CREATE STAGE ---
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .vis-container {
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
          flex: 1; 
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
      <div class="vis-container" id="vis-container"></div>
    `;
  },

  // --- 2. UPDATE STAGE ---
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // SAFEGUARD 1: Make sure the query actually has fields defined
    if (!queryResponse || !queryResponse.fields || !queryResponse.fields.measure_like) {
      this.addError({title: "No Data", message: "Please add at least one measure to your Explore."});
      return done();
    }

    const measures = queryResponse.fields.measure_like;
    if (measures.length === 0) {
      this.addError({title: "No Measures", message: "This chart requires at least one measure."});
      return done();
    }

    // SAFEGUARD 2: Make sure the query returned actual rows!
    if (!data || data.length === 0) {
      this.addError({title: "No Results", message: "Your query returned no data. Please adjust your filters."});
      return done();
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
      
      dynamicOptions[`useConditional_${fieldName}`] = { section: menuSection, type: "boolean", label: "Use Conditional Bar Color", default: false };
      dynamicOptions[`targetThreshold_${fieldName}`] = { section: menuSection, type: "number", label: "Success Threshold (%)", default: 100 };
      dynamicOptions[`successColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Target Met Color", default: "#34A853" };
      dynamicOptions[`dangerColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Target Missed Color", default: "#EA4335" };
      dynamicOptions[`defaultBarColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Standard Bar Color", default: "#9AA0A6" };
      dynamicOptions[`targetBarColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: "Target Background Color", default: "#E8EAED" };
    }

    this.trigger('registerOptions', dynamicOptions);

    // --- HELPER: BASIC NUMBER FORMATTER ---
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

      const showTitle = config[`showTitle_${fieldName}`] !== false; 
      const customTitle = config[`customTitle_${fieldName}`] || actualField.label_short || actualField.label;
      const titlePlacement = config[`titlePlacement_${fieldName}`] || "above";
      const valueFormat = config[`valueFormat_${fieldName}`];
      const color = config[`color_${fieldName}`] || "#333333";

      const actualValue = row[actualField.name].value;
      const actualText = formatValue(actualValue, valueFormat, row[actualField.name].rendered);

      const isLast = (i >= measures.length - 2);
      let borderStyle = "";
      if (showDividers && !isLast) {
        borderStyle = orientation === "row" ? "border-right: 1px solid #ddd;" : "border-bottom: 1px solid #ddd;";
      }

      let paddingStyle = orientation === "row" 
        ? `padding: 0 ${gap / 2}px;` 
        : `padding: ${gap / 2}px 0;`;

      html += `<div class="metric-block" style="${borderStyle} ${paddingStyle} text-align: ${config.globalAlign};">`;

      const titleHtml = `<div class="metric-title" style="color: ${color}; font-size: ${Math.max(12, (config.globalFontSize || 42) * 0.35)}px; margin: 5px 0;">${customTitle}</div>`;
      const valueHtml = `<div class="metric-value" style="color: ${color}; font-size: ${config.globalFontSize || 42}px; margin: 5px 0;">${actualText}</div>`;

      if (showTitle && titlePlacement === "above") html += titleHtml;
      html += valueHtml;
      if (showTitle && titlePlacement === "below") html += titleHtml;

      if (targetField) {
        const targetValue = row[targetField.name].value;
        const targetText = formatValue(targetValue, valueFormat, row[targetField.name].rendered);

        const percentRaw = targetValue ? (actualValue / targetValue) * 100 : 0;
        const percentVisual = Math.min(Math.max(percentRaw, 0), 100);

        const useConditional = config[`useConditional_${fieldName}`];
        const targetThreshold = config[`targetThreshold_${fieldName}`] !== undefined ? config[`targetThreshold_${fieldName}`] : 100;
        
        let activeBarColor = config[`defaultBarColor_${fieldName}`] || "#9AA0A6";
        if (useConditional) {
          activeBarColor = (percentRaw >= targetThreshold) 
            ? (config[`successColor_${fieldName}`] || "#34A853") 
            : (config[`dangerColor_${fieldName}`] || "#EA4335");
        }

        const bgBarColor = config[`targetBarColor_${fieldName}`] || "#E8EAED";

        html += `
          <div class="progress-bg" style="background-color: ${bgBarColor}; height: ${barHeight}px; margin-top: 10px;">
            <div class="progress-bar" style="background-color: ${activeBarColor}; width: ${percentVisual}%;"></div>
            <div class="progress-text" style="color: ${color}; line-height: ${barHeight}px;">
              ${Math.round(percentRaw)}% of ${targetText} ${targetField.label_short || targetField.label}
            </div>
          </div>
        `;
      }
      
      html += `</div>`;
    }

    // SAFEGUARD 3: properly scope the DOM to the Looker iframe element
    const container = element.querySelector("#vis-container");
    if (container) {
      container.style.flexDirection = orientation;
      container.style.padding = orientation === "row" ? `20px ${gap/2}px` : `${gap/2}px 20px`;
      container.innerHTML = html;
    }

    done();
  }
});
