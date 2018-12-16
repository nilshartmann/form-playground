import React from "react";

export default function ErrorDisplay(props: { errorMessages?: string[] }) {
    const errorMessages = props.errorMessages;
    return <div className="ErrorDisplay">
        {errorMessages ?
            <ul>{errorMessages.map((msg, ix) => <li key={ix}>{msg}</li>)}</ul> :
            ''
        }
    </div>
}