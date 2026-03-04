looker.plugins.visualizations.add({
  // --- 1. IDENTIFICATION ---
  // A unique ID for your vis and the human-readable label for the menu
  id: "my_custom_viz_boilerplate",
  label: "My Custom Chart",

 // --- 2. CONFIGURATION OPTIONS ---
  // This creates the color pickers in the Looker gear menu!
  options: {
    textColor: {
      type: "string",
      label: "Main Text Color",
      display: "color",
      default: "#333333"
    },
    actualBarColor: {
      type: "string",
      label: "Progress Bar (Actual)",
      display: "color",
      default: "#9AA0A6"
    },
    targetBarColor: {
      type: "string",
      label: "Progress Bar (Target Background)",
      display: "color",
      default: "#E8EAED"
    },
    barTextColor: {
      type: "string",
      label: "Text Color inside Bar",
      display: "color",
      default: "#333333"
    }
  },

  // --- 3. CREATE STAGE ---
  // Runs exactly ONCE when the visualization is first initialized.
  // Use this to set up your HTML/SVG containers.
  create: function(element, config) {
    // 'element' is the DOM node Looker gives you to draw inside of.
    element.innerHTML = `
      <style>
        .my-vis-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
        }
      </style>
      <div class="my-vis-container" id="vis-content">
        Waiting for data...
      </div>
    `;
  },

 // --- 4. UPDATE STAGE ---
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Grab the measures from the query
    const measures = queryResponse.fields.measure_like;
    const row = data[0]; 

    // Create our main container wrapper
    let html = `<div style="display: flex; flex-direction: column; gap: 40px; font-family: 'Open Sans', sans-serif; text-align: center; color: ${config.textColor}; padding: 20px;">`;

    // Loop through the data columns in pairs (Column 1 is Actual, Column 2 is Target)
    for (let i = 0; i < measures.length; i += 2) {
      const actualField = measures[i];
      const targetField = measures[i + 1]; // This will be undefined for your 5th column (Average Daily Revenue)

      // Use .rendered to get Looker's built-in formatting (e.g., "$257,774")
      // If .rendered isn't available, fallback to the raw .value
      const actualText = row[actualField.name].rendered || row[actualField.name].value;
      const actualValue = row[actualField.name].value;

      // Build the Title and Big Number
      html += `<div>`;
      html += `<div style="font-size: 14px; margin-bottom: 5px; color: #555;">${actualField.label_short || actualField.label}</div>`;
      html += `<div style="font-size: 42px; font-weight: 300; margin-bottom: 15px;">${actualText}</div>`;

      // If there is a matching target column next to it, build the progress bar
      if (targetField) {
        const targetText = row[targetField.name].rendered || row[targetField.name].value;
        const targetValue = row[targetField.name].value;

        // Calculate percentage. We cap the visual width at 100% so the bar doesn't break out of its container if you beat the goal.
        const percentRaw = (actualValue / targetValue) * 100;
        const percentVisual = Math.min(percentRaw, 100);

        html += `
          <div style="background-color: ${config.targetBarColor}; height: 32px; width: 100%; position: relative;">
            <div style="background-color: ${config.actualBarColor}; height: 100%; width: ${percentVisual}%;"></div>
            
            <div style="position: absolute; top: 0; left: 0; width: 100%; line-height: 32px; font-size: 12px; color: ${config.barTextColor};">
              ${Math.round(percentRaw)}% of ${targetText} ${targetField.label_short || targetField.label}
            </div>
          </div>
        `;
      }
      
      html += `</div>`; // Close the block
    }

    html += `</div>`; // Close the main wrapper

    // Push the HTML to the DOM
    const container = document.getElementById("vis-content");
    container.innerHTML = html;

    done();
  }
});