import axios from 'axios';
import React, { Component }  from 'react';

import Nav from './components/nav';
import DynamicSearch from './components/dynamic_search';
import PageContainer from './components/page_container';


var countries = [
  {"name": "Sweden"}, {"name": "China"}, {"name": "Peru"}, {"name": "Czech Republic"},
  {"name": "Bolivia"}, {"name": "Latvia"}, {"name": "Samoa"}, {"name": "Armenia"},
  {"name": "Greenland"}, {"name": "Cuba"}, {"name": "Western Sahara"}, {"name": "Ethiopia"},
  {"name": "Malaysia"}, {"name": "Argentina"}, {"name": "Uganda"}, {"name": "Chile"},
  {"name": "Aruba"}, {"name": "Japan"}, {"name": "Trinidad and Tobago"}, {"name": "Italy"},
  {"name": "Cambodia"}, {"name": "Iceland"}, {"name": "Dominican Republic"}, {"name": "Turkey"},
  {"name": "Spain"}, {"name": "Poland"}, {"name": "Haiti"}
];

  
let MainContent = (
  <div>
    <Nav />
    <PageContainer>
      <DynamicSearch items={ countries } />
    </PageContainer>
  </div>
);

ReactDOM.render(
  MainContent , 
  document.getElementById("app-container")
);
