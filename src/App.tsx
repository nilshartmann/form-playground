import React, { Component } from "react";
import OrderForm from "./OrderForm";

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
            <OrderForm />
          </main>
        </div>
      </>
    );
  }
}

export default App;
