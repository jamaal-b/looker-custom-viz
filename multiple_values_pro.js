looker.plugins.visualizations.add({
  id: "multiple_values_pro",
  label: "Multiple Values Pro",
  
  // We leave options empty initially. We will build them dynamically based on the data!
  options: {},

  // --- 1. CREATE STAGE ---
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .multiple-values-container {
          display: flex;
          flex-direction: column;
          gap: 40px;
          font-family: 'Open Sans', Roboto, sans-serif;
          text-align: center;
          padding: 20px;
        }
        .metric-block {
          display: flex;
          flex-direction: column;
        }
        .metric-title {
          font-size: 14px;
          margin-bottom: 5px;
        }
        .metric-value {
          font-size: 42px;
          font-weight: 300;
          margin-bottom: 15px;
        }
        .progress-bg {
          height: 32px;
          width: 100%;
          position: relative;
          background-color: #E8EAED; /* Default background */
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
          line-height: 32px;
          font-size: 12px;
        }
      </style>
      <div class="multiple-values-container" id="vis-content">
        Loading data...
      </div>
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

    // --- STEP A: DYNAMICALLY BUILD THE MENU ---
    // Loop through our measures in pairs to build settings for each specific pair
    for (let i = 0; i < measures.length; i += 2) {
      const actualField = measures[i];
      const fieldName = actualField.name;
      // We use the field label to group the settings nicely in the Looker menu
      const menuSection = actualField.label_short || actualField.label; 

      dynamicOptions[`textColor_${fieldName}`] = {
        section: menuSection,
        type: "string", label: "Main Text Color", display: "color", default: "#333333"
      };
      dynamicOptions[`useConditional_${fieldName}`] = {
        section: menuSection,
        type: "boolean", label: "Use Conditional Formatting (>= 100%)", default: false
      };
      dynamicOptions[`targetThreshold_${fieldName}`] = {
        section: menuSection,
        type: "number", label: "Success Threshold (%)", default: 100
      };
      dynamicOptions[`successColor_${fieldName}`] = {
        section: menuSection,
        type: "string", label: "Target Met Color (e.g. Green)", display: "color", default: "#34A853"
      };
      dynamicOptions[`dangerColor_${fieldName}`] = {
        section: menuSection,
        type: "string", label: "Target Missed Color (e.g. Red)", display: "color", default: "#EA4335"
      };
      dynamicOptions[`defaultBarColor_${fieldName}`] = {
        section: menuSection,
        type: "string", label: "Standard Bar Color (If not conditional)", display: "color", default: "#9AA0A6"
      };
    }

    // Tell Looker to update the gear menu with our newly generated options
    this.trigger('registerOptions', dynamicOptions);


    // --- STEP B: RENDER THE HTML ---
    let html = ``;

    for (let i = 0; i < measures.length; i += 2) {
      const actualField = measures[i];
      const targetField = measures[i + 1];
      const fieldName = actualField.name;

      // Pull the user's config choices (or use defaults if they haven't set them yet)
      const textColor = config[`textColor_${fieldName}`] || "#333333";
      const useConditional = config[`useConditional_${fieldName}`];
      const successColor = config[`successColor_${fieldName}`] || "#34A853";
      const dangerColor = config[`dangerColor_${fieldName}`] || "#EA4335";
      const targetThreshold = config[`targetThreshold_${fieldName}`] !== undefined ? config[`targetThreshold_${fieldName}`] : 100;
      const defaultBarColor = config[`defaultBarColor_${fieldName}`] || "#9AA0A6";

      const actualValue = row[actualField.name].value;
      const actualText = row[actualField.name].rendered || row[actualField.name].value;
      
      html += `<div class="metric-block" style="color: ${textColor};">`;
      html += `<div class="metric-title" style="color: ${textColor}; opacity: 0.8;">${actualField.label_short || actualField.label}</div>`;
      html += `<div class="metric-value">${actualText}</div>`;

      // If there is a target field, render the progress bar
      if (targetField) {
        const targetValue = row[targetField.name].value;
        const targetText = row[targetField.name].rendered || row[targetField.name].value;

        const percentRaw = (actualValue / targetValue) * 100;
        const percentVisual = Math.min(percentRaw, 100);

        // FIGURE OUT THE BAR COLOR
        let activeBarColor = defaultBarColor;
        if (useConditional) {
          activeBarColor = (percentRaw >= targetThreshold) ? successColor : dangerColor;
        }

        html += `
          <div class="progress-bg">
            <div class="progress-bar" style="background-color: ${activeBarColor}; width: ${percentVisual}%;"></div>
            <div class="progress-text" style="color: ${textColor};">
              ${Math.round(percentRaw)}% of ${targetText} ${targetField.label_short || targetField.label}
            </div>
          </div>
        `;
      }
      
      html += `</div>`;
    }

    // Push the final HTML to the container
    document.getElementById("vis-content").innerHTML = html;
    
    // Tell Looker we are done rendering
    done();
  }
});
