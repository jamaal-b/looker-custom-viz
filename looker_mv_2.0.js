looker.plugins.visualizations.add({
  id: "looker_mv_2.0",
  label: "Multiple Values 2.0",

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
    dynamicOptions["comparisonMode"] = {
      section: "Global Settings", type: "string", display: "select",
      label: "Comparison Mode",
      values: [{"Auto Pair (1st↔2nd, 3rd↔4th)": "auto"}, {"Manual (choose targets)": "manual"}, {"No Comparison": "none"}],
      default: "auto"
    };
    dynamicOptions["globalFontSize"] = { section: "Global Settings", type: "number", label: "Font Size (Main Number)", default: 42 };
    dynamicOptions["globalOrientation"] = { section: "Global Settings", type: "string", display: "select", label: "Orientation", values: [{"Horizontal": "row"}, {"Vertical": "column"}], default: "column" };
    dynamicOptions["globalDividers"] = { section: "Global Settings", type: "boolean", label: "Dividers between values?", default: false };
    dynamicOptions["globalGap"] = { section: "Global Settings", type: "number", label: "Spacing Between Metrics (px)", default: 40 };
    dynamicOptions["globalBarHeight"] = { section: "Global Settings", type: "number", label: "Progress Bar Height (px)", default: 32 };
    dynamicOptions["globalAlign"] = { section: "Global Settings", type: "string", display: "select", label: "Text Alignment", values: [{"Center": "center"}, {"Left": "left"}, {"Right": "right"}], default: "center" };

    const mode = config.comparisonMode || "auto";

    // --- DEFAULT COLORS ---
    const DEFAULT_BAR_COLOR = "#34A853";       // green
    const DEFAULT_BG_COLOR = "#EA4335";        // red
    const DEFAULT_SUCCESS_COLOR = "#34A853";   // green
    const DEFAULT_DANGER_COLOR = "#EA4335";    // red
    const DEFAULT_TEXT_COLOR = "#333333";

    // --- PER-METRIC SETTINGS ---
    // Build target dropdown values for manual mode
    const targetChoices = [{"None": ""}];
    for (let m = 0; m < measures.length; m++) {
      const label = measures[m].label_short || measures[m].label;
      const entry = {};
      entry[label] = measures[m].name;
      targetChoices.push(entry);
    }

    // Determine which measures get their own metric block
    // Auto Pair: only even-indexed measures (odd ones are consumed as targets)
    // Manual / None: all measures
    const displayIndices = [];
    if (mode === "auto") {
      for (let i = 0; i < measures.length; i += 2) {
        displayIndices.push(i);
      }
    } else {
      for (let i = 0; i < measures.length; i++) {
        displayIndices.push(i);
      }
    }

    for (let idx = 0; idx < displayIndices.length; idx++) {
      const i = displayIndices[idx];
      const field = measures[i];
      const fieldName = field.name;
      const shortLabel = field.label_short || field.label;
      const menuSection = "Metric Settings";

      // Core display options (always shown)
      dynamicOptions[`showTitle_${fieldName}`] = { section: menuSection, type: "boolean", label: shortLabel + " — Show Title", default: true, order: idx * 20 };
      dynamicOptions[`customTitle_${fieldName}`] = { section: menuSection, type: "string", label: shortLabel + " — Title", default: shortLabel, order: idx * 20 + 1 };
      dynamicOptions[`titlePlacement_${fieldName}`] = { section: menuSection, type: "string", display: "select", label: shortLabel + " — Title Placement", values: [{"Above number": "above"}, {"Below number": "below"}], default: "above", order: idx * 20 + 2 };
      dynamicOptions[`valueFormat_${fieldName}`] = { section: menuSection, type: "string", label: shortLabel + " — Value Format (e.g. $#,##0)", default: "", order: idx * 20 + 3 };
      dynamicOptions[`color_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: shortLabel + " — Color", default: DEFAULT_TEXT_COLOR, order: idx * 20 + 4 };

      // Manual mode: target selector
      if (mode === "manual") {
        dynamicOptions[`targetField_${fieldName}`] = {
          section: menuSection, type: "string", display: "select",
          label: shortLabel + " — Compare To",
          values: targetChoices,
          default: "",
          order: idx * 20 + 5
        };
      }

      // Progress bar options (hidden in "none" mode)
      if (mode !== "none") {
        dynamicOptions[`useDefaultColors_${fieldName}`] = { section: menuSection, type: "boolean", label: shortLabel + " — Use Default Colors", default: true, order: idx * 20 + 6 };
        dynamicOptions[`useConditional_${fieldName}`] = { section: menuSection, type: "boolean", label: shortLabel + " — Use Conditional Bar Color", default: false, order: idx * 20 + 7 };
        dynamicOptions[`targetThreshold_${fieldName}`] = { section: menuSection, type: "number", label: shortLabel + " — Success Threshold (%)", default: 100, order: idx * 20 + 8 };
        dynamicOptions[`successColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: shortLabel + " — Target Met Color", default: DEFAULT_SUCCESS_COLOR, order: idx * 20 + 9 };
        dynamicOptions[`dangerColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: shortLabel + " — Target Missed Color", default: DEFAULT_DANGER_COLOR, order: idx * 20 + 10 };
        dynamicOptions[`defaultBarColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: shortLabel + " — Standard Bar Color", default: DEFAULT_BAR_COLOR, order: idx * 20 + 11 };
        dynamicOptions[`targetBarColor_${fieldName}`] = { section: menuSection, type: "string", display: "color", label: shortLabel + " — Target Background Color", default: DEFAULT_BG_COLOR, order: idx * 20 + 12 };
      }
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

    // --- HELPER: Resolve target field for a given measure index ---
    function getTargetField(measureIndex) {
      if (mode === "none") return null;

      if (mode === "manual") {
        const fieldName = measures[measureIndex].name;
        const targetName = config[`targetField_${fieldName}`];
        if (!targetName) return null;
        return measures.find(function(m) { return m.name === targetName; }) || null;
      }

      // Auto pair: next measure is the target
      if (measureIndex + 1 < measures.length) {
        return measures[measureIndex + 1];
      }
      return null;
    }

    // --- RENDER HTML ---
    const orientation = config.globalOrientation || "column";
    const gap = config.globalGap !== undefined ? config.globalGap : 40;
    const barHeight = config.globalBarHeight !== undefined ? config.globalBarHeight : 32;
    const showDividers = config.globalDividers;

    let html = ``;

    for (let idx = 0; idx < displayIndices.length; idx++) {
      const i = displayIndices[idx];
      const actualField = measures[i];
      const fieldName = actualField.name;
      const targetField = getTargetField(i);

      const showTitle = config[`showTitle_${fieldName}`] !== false;
      const customTitle = config[`customTitle_${fieldName}`] || actualField.label_short || actualField.label;
      const titlePlacement = config[`titlePlacement_${fieldName}`] || "above";
      const valueFormat = config[`valueFormat_${fieldName}`];
      const color = config[`color_${fieldName}`] || DEFAULT_TEXT_COLOR;

      const actualValue = row[actualField.name].value;
      const actualText = formatValue(actualValue, valueFormat, row[actualField.name].rendered);

      const isLast = (idx >= displayIndices.length - 1);
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

        const useDefaults = config[`useDefaultColors_${fieldName}`] !== false;
        const useConditional = config[`useConditional_${fieldName}`];
        const targetThreshold = config[`targetThreshold_${fieldName}`] !== undefined ? config[`targetThreshold_${fieldName}`] : 100;

        let activeBarColor = useDefaults ? DEFAULT_BAR_COLOR : (config[`defaultBarColor_${fieldName}`] || DEFAULT_BAR_COLOR);
        if (useConditional) {
          const successColor = useDefaults ? DEFAULT_SUCCESS_COLOR : (config[`successColor_${fieldName}`] || DEFAULT_SUCCESS_COLOR);
          const dangerColor = useDefaults ? DEFAULT_DANGER_COLOR : (config[`dangerColor_${fieldName}`] || DEFAULT_DANGER_COLOR);
          activeBarColor = (percentRaw >= targetThreshold) ? successColor : dangerColor;
        }

        const bgBarColor = useDefaults ? DEFAULT_BG_COLOR : (config[`targetBarColor_${fieldName}`] || DEFAULT_BG_COLOR);

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
