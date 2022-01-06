import * as React from "react";

const AppContext = React.createContext({
    isDarkMode: false,
    toggleDarkMode: () => {}
});

const AppProvider = AppContext.Provider;
const AppConsumer = AppContext.Consumer;

export { AppProvider, AppConsumer };
