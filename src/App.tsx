import React, { Component } from "react";
import PizzaForm from "./PizzaForm";

class App extends Component {
  render() {
    return (
      <>
        <header>
          <h1>React Form Playground</h1>
          <div>React {React.version}</div>
        </header>
        <div className="PageContainer">
          <main>
            <h1>Pizza ist das Beste...</h1>
            <PizzaForm />
          </main>
        </div>
      </>
    );
  }
}

export default App;
